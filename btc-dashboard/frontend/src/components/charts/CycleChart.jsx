/**
 * CycleChart.jsx
 * Comparador de Ciclos: Alta / Baixa / Halving
 * Dados: priceData = [[ts_ms, close, high], ...]
 *
 * Ciclos de Alta (fundo→topo):
 *   C1: 17/11/2011 $1.99 → 04/12/2013 $1240
 *   C2: 14/01/2015 $166.45 → 17/12/2017 $19804
 *   C3: 15/12/2018 $3124.50 → 10/11/2021 $68997
 *   C4: 21/11/2022 $15473 → 06/10/2025 $126219
 *
 * Ciclos de Baixa (topo→fundo):
 *   B1: 04/12/2013 $1240 → 14/01/2015 $166.45
 *   B2: 17/12/2017 $19804 → 15/12/2018 $3124.50
 *   B3: 10/11/2021 $68997 → 21/11/2022 $15473
 *   B4: 06/10/2025 $126219 → ???
 *
 * Halvings:
 *   H1: 28/11/2012 → 09/07/2016
 *   H2: 09/07/2016 → 11/05/2020
 *   H3: 11/05/2020 → 19/04/2024
 *   H4: 19/04/2024 → hoje (próximo halving ~2028)
 */

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';

// ─── Paleta de cores dos ciclos ───────────────────────────────────────────────
const CYCLE_COLORS = [
  '#f7931a', // laranja BTC — ciclo mais antigo
  '#3b82f6', // azul
  '#22c55e', // verde
  '#a855f7', // roxo
  '#ec4899', // rosa
  '#14b8a6', // teal
];

const MEAN_COLOR   = '#ffffff';
const STDDEV_COLOR = 'rgba(255,255,255,0.12)';

// ─── Definições de ciclos ─────────────────────────────────────────────────────

// Datas dos eventos principais (valores fixos fornecidos pelo usuário)
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
  { label: 'Ciclo 1',  start: '2011-11-17', end: '2013-12-04', startPrice: 1.99,    endPrice: 1240    },
  { label: 'Ciclo 2',  start: '2015-01-14', end: '2017-12-17', startPrice: 166.45,  endPrice: 19804   },
  { label: 'Ciclo 3',  start: '2018-12-15', end: '2021-11-10', startPrice: 3124.5,  endPrice: 68997   },
  { label: 'Ciclo 4',  start: '2022-11-21', end: '2025-10-06', startPrice: 15473,   endPrice: 126219  },
];

const BEAR_CYCLES = [
  { label: 'Baixa 1',  start: '2013-12-04', end: '2015-01-14', startPrice: 1240,    endPrice: 166.45  },
  { label: 'Baixa 2',  start: '2017-12-17', end: '2018-12-15', startPrice: 19804,   endPrice: 3124.5  },
  { label: 'Baixa 3',  start: '2021-11-10', end: '2022-11-21', startPrice: 68997,   endPrice: 15473   },
  { label: 'Baixa 4 (atual)', start: '2025-10-06', end: null,  startPrice: 126219,  endPrice: null    },
];

const HALVING_CYCLES = [
  { label: 'Halving 1', start: '2012-11-28', end: '2016-07-09' },
  { label: 'Halving 2', start: '2016-07-09', end: '2020-05-11' },
  { label: 'Halving 3', start: '2020-05-11', end: '2024-04-19' },
  { label: 'Halving 4 (atual)', start: '2024-04-19', end: null },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToMs(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').getTime();
}

function msToDateStr(ms) {
  return new Date(ms).toISOString().split('T')[0];
}

function fmtMultiple(v) {
  if (v >= 10)  return v.toFixed(1) + 'x';
  return v.toFixed(2) + 'x';
}

// Constrói mapa date→price a partir do priceData
function buildPriceMap(priceData) {
  const map = new Map();
  for (const [ts, close] of priceData) {
    map.set(msToDateStr(ts), close);
  }
  // Sobrescreve com valores âncora conhecidos
  for (const [date, price] of Object.entries(ANCHOR_PRICES)) {
    map.set(date, price);
  }
  return map;
}

// Interpola preço para uma data que pode não estar no mapa
function getPrice(map, dateStr, priceData) {
  if (map.has(dateStr)) return map.get(dateStr);
  // Fallback: procura o dia mais próximo
  const ts = dateToMs(dateStr);
  let best = null, bestDiff = Infinity;
  for (const [t, c] of priceData) {
    const d = Math.abs(t - ts);
    if (d < bestDiff) { bestDiff = d; best = c; }
  }
  return best;
}

// Gera série normalizada para um ciclo de alta/baixa
function buildCycleSeries(priceData, priceMap, startDate, endDate, startPrice) {
  const startMs = dateToMs(startDate);
  const endMs   = endDate ? dateToMs(endDate) : Date.now();

  const points = [];

  // Ponto inicial forçado
  points.push([0, 1.0]);

  // Percorre priceData
  for (const [ts, close] of priceData) {
    if (ts < startMs) continue;
    if (ts > endMs)   break;
    const dayN = Math.round((ts - startMs) / 86400000);
    if (dayN === 0) continue; // já adicionamos o dia 0
    points.push([dayN, close / startPrice]);
  }

  // Ponto final forçado (se temos o preço do topo/fundo)
  if (endDate) {
    const endMs2 = dateToMs(endDate);
    const endPrice = getPrice(priceMap, endDate, priceData);
    if (endPrice) {
      const dayN = Math.round((endMs2 - startMs) / 86400000);
      points.push([dayN, endPrice / startPrice]);
    }
  }

  // Deduplica por dia
  const seen = new Set();
  return points.filter(([d]) => {
    if (seen.has(d)) return false;
    seen.add(d);
    return true;
  }).sort((a, b) => a[0] - b[0]);
}

// Gera série normalizada para um ciclo de halving
function buildHalvingSeries(priceData, priceMap, startDate, endDate) {
  const startMs   = dateToMs(startDate);
  const endMs     = endDate ? dateToMs(endDate) : Date.now();
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
  return points.filter(([d]) => {
    if (seen.has(d)) return false;
    seen.add(d);
    return true;
  }).sort((a, b) => a[0] - b[0]);
}

// Calcula média e desvio padrão dia a dia para N séries anteriores
function buildMeanStdDev(seriesList) {
  if (!seriesList.length) return { mean: [], upper: [], lower: [] };

  const maxDay = Math.max(...seriesList.map(s => s[s.length - 1]?.[0] ?? 0));

  // Para cada dia, coleta valores de todas as séries (interpolando se necessário)
  const mean = [], upper = [], lower = [];

  for (let d = 0; d <= maxDay; d++) {
    const vals = seriesList.map(series => {
      // Procura o ponto exato ou interpola
      const exact = series.find(p => p[0] === d);
      if (exact) return exact[1];

      const before = [...series].reverse().find(p => p[0] < d);
      const after  = series.find(p => p[0] > d);
      if (!before && !after) return null;
      if (!before) return after[1];
      if (!after)  return d <= series[series.length - 1][0] ? before[1] : null;

      // Interpolação linear
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
    lower.push([d, avg - std]);
  }

  return { mean, upper, lower };
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function CycleChart({ priceData, loading, error }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  const [mode, setMode]           = useState('halving');   // 'bull' | 'bear' | 'halving'
  const [showMean, setShowMean]   = useState(false);
  const [showStd,  setShowStd]    = useState(false);
  const [echartsReady, setEchartsReady] = useState(false);

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  // ── Dados processados ──
  const priceMap = useMemo(() => {
    if (!priceData?.length) return new Map();
    return buildPriceMap(priceData);
  }, [priceData]);

  const { cycleDefs, seriesList } = useMemo(() => {
    if (!priceData?.length) return { cycleDefs: [], seriesList: [] };

    if (mode === 'bull') {
      const defs = BULL_CYCLES;
      const list = defs.map(c => buildCycleSeries(priceData, priceMap, c.start, c.end, c.startPrice));
      return { cycleDefs: defs, seriesList: list };
    }
    if (mode === 'bear') {
      const defs = BEAR_CYCLES;
      const list = defs.map(c => buildCycleSeries(priceData, priceMap, c.start, c.end, c.startPrice));
      return { cycleDefs: defs, seriesList: list };
    }
    // halving
    const defs = HALVING_CYCLES;
    const list = defs.map(c => buildHalvingSeries(priceData, priceMap, c.start, c.end));
    return { cycleDefs: defs, seriesList: list };
  }, [priceData, priceMap, mode]);

  // Último ciclo = atual (não entra na média)
  const { mean, upper, lower } = useMemo(() => {
    if (!showMean || seriesList.length < 2) return { mean: [], upper: [], lower: [] };
    const previous = seriesList.slice(0, -1); // todos exceto o atual
    return buildMeanStdDev(previous);
  }, [seriesList, showMean]);

  // ── Build ECharts option (callback, not memo) ──
  const buildOption = useCallback(() => {
    if (!priceData?.length || !cycleDefs.length) return null;

    const mainSeries = cycleDefs.map((c, i) => ({
      type: 'line',
      name: c.label,
      data: seriesList[i].map(([d, v]) => [d, v]),
      smooth: false,
      symbol: 'none',
      lineStyle: {
        color: CYCLE_COLORS[i % CYCLE_COLORS.length],
        width: i === cycleDefs.length - 1 ? 2.5 : 1.8,
        opacity: i === cycleDefs.length - 1 ? 1 : 0.85,
      },
      emphasis: { disabled: true },
      z: i === cycleDefs.length - 1 ? 5 : 3,
    }));

    const extraSeries = [];

    if (showMean && mean.length) {
      extraSeries.push({
        type: 'line',
        name: 'Média (ciclos anteriores)',
        data: mean.map(([d, v]) => [d, v]),
        smooth: false,
        symbol: 'none',
        lineStyle: { color: MEAN_COLOR, width: 2, type: 'dashed' },
        z: 6,
      });

      if (showStd && upper.length && lower.length) {
        // Banda de desvio padrão usando areaStyle entre upper e lower
        extraSeries.push({
          type: 'line',
          name: 'σ superior',
          data: upper.map(([d, v]) => [d, v]),
          smooth: false,
          symbol: 'none',
          lineStyle: { color: 'transparent', width: 0 },
          areaStyle: { color: STDDEV_COLOR },
          stack: '__std__',
          z: 2,
          silent: true,
          emphasis: { disabled: true },
        });
        extraSeries.push({
          type: 'line',
          name: 'σ inferior',
          data: lower.map(([d, v]) => [d, v]),
          smooth: false,
          symbol: 'none',
          lineStyle: { color: 'transparent', width: 0 },
          areaStyle: { color: '#111120' }, // cobre a metade de baixo
          stack: '__std__',
          z: 2,
          silent: true,
          emphasis: { disabled: true },
        });
      }
    }

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: { top: 24, left: 76, right: 32, bottom: 64 },
      legend: {
        show: true,
        bottom: 8,
        textStyle: { color: '#9090b0', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        itemWidth: 20,
        itemHeight: 2,
        icon: 'rect',
        formatter: name => {
          if (name === 'σ superior' || name === 'σ inferior') return '';
          return name;
        },
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
            .filter(p => p.seriesName !== 'σ superior' && p.seriesName !== 'σ inferior')
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
        nameGap: 36,
        nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        axisLine: { lineStyle: { color: '#1e1e35' } },
        axisTick: { show: false },
        axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        min: 0,
      },
      yAxis: {
        type: 'log',
        logBase: 10,
        name: 'Retorno (normalizado em 1×)',
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
        min: value => Math.max(0.01, value.min * 0.8),
      },
      series: [...mainSeries, ...extraSeries],
    };
  }, [cycleDefs, seriesList, showMean, showStd, mean, upper, lower, priceData]);

  // ── Init chart (runs once when echarts + data are ready) ──
  useEffect(() => {
    if (!echartsReady || !chartRef.current || !priceData?.length) return;
    const init = async () => {
      const echarts = await import('echarts');
      if (!chartInst.current) {
        const chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        chartInst.current = chart;
        new ResizeObserver(() => chart.resize()).observe(chartRef.current);
      }
      const option = buildOption();
      if (option) chartInst.current.setOption(option, { notMerge: true });
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echartsReady, priceData?.length]);

  // ── Update chart when options change ──
  useEffect(() => {
    const chart = chartInst.current;
    if (!chart || !priceData?.length) return;
    const option = buildOption();
    if (option) chart.setOption(option, { notMerge: true });
  }, [buildOption]);

  // ── Stats do ciclo atual ──
  const currentCycle = cycleDefs[cycleDefs.length - 1];
  const currentSeries = seriesList[seriesList.length - 1] ?? [];
  const maxReturn = currentSeries.length
    ? Math.max(...currentSeries.map(([, v]) => v))
    : null;
  const totalDays = currentSeries.length
    ? currentSeries[currentSeries.length - 1][0]
    : 0;

  const hasData = priceData?.length > 0;

  return (
    <div className="cycle-chart-wrapper">
      {/* Mode selector */}
      <div className="mode-selector">
        <button
          className={`mode-btn ${mode === 'halving' ? 'active' : ''}`}
          onClick={() => setMode('halving')}
        >
          <span className="mode-icon">⬡</span>
          Performance a partir do Halving
        </button>
        <button
          className={`mode-btn ${mode === 'bull' ? 'active' : ''}`}
          onClick={() => setMode('bull')}
        >
          <span className="mode-icon">↑</span>
          Ciclos de Alta
        </button>
        <button
          className={`mode-btn ${mode === 'bear' ? 'active' : ''}`}
          onClick={() => setMode('bear')}
        >
          <span className="mode-icon">↓</span>
          Ciclos de Baixa
        </button>
      </div>

      {/* Chart header */}
      <div className="chart-header">
        <div className="chart-left">
          {currentCycle && (
            <>
              <span className="cycle-label">
                {mode === 'halving' ? 'Halving atual' :
                 mode === 'bull'    ? 'Ciclo de alta atual' :
                                     'Ciclo de baixa atual'}
              </span>
              <span className="cycle-name">{currentCycle.label}</span>
              {totalDays > 0 && (
                <span className="cycle-stat">
                  {totalDays} dias
                </span>
              )}
              {maxReturn && maxReturn > 1 && (
                <span className="cycle-stat">
                  Máx: {fmtMultiple(maxReturn)}
                </span>
              )}
            </>
          )}
        </div>
        <div className="chart-controls">
          {/* Checkbox média */}
          <label className={`check-box ${showMean ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={showMean}
              onChange={e => {
                setShowMean(e.target.checked);
                if (!e.target.checked) setShowStd(false);
              }}
            />
            <span className="check-indicator" />
            Média (ciclos anteriores)
          </label>

          {/* Checkbox desvio padrão — só aparece quando média está ativa */}
          {showMean && (
            <label className={`check-box ${showStd ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={showStd}
                onChange={e => setShowStd(e.target.checked)}
              />
              <span className="check-indicator" />
              ±1 Desvio Padrão
            </label>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className="chart-area">
        {(loading || error || !hasData) && (
          <div className="chart-state">
            {loading && <><div className="spinner" /><span>Carregando...</span></>}
            {error   && <span style={{ color: '#ef4444' }}>⚠ {error}</span>}
            {!loading && !error && !hasData && <span>Sem dados disponíveis.</span>}
          </div>
        )}
        <div
          ref={chartRef}
          className="echarts-canvas"
          style={{ opacity: loading || error || !hasData ? 0 : 1 }}
        />
      </div>

      {/* Footer */}
      {hasData && (
        <div className="chart-footer">
          <span>Escala logarítmica · normalizado em 1× no início de cada ciclo</span>
          <span>·</span>
          <span>Fonte: Yahoo Finance / CoinMetrics</span>
          <span>·</span>
          <span>Topos e fundos: dados históricos verificados</span>
        </div>
      )}

      <style jsx>{`
        .cycle-chart-wrapper {
          display: flex;
          flex-direction: column;
        }

        /* ── Mode selector ── */
        .mode-selector {
          display: flex;
          gap: 8px;
          padding: 16px 20px 0;
        }

        .mode-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 16px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.03em;
          color: var(--text-muted);
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .mode-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.05);
          border-color: var(--border-default);
        }

        .mode-btn.active {
          color: var(--brand-orange);
          background: rgba(247,147,26,0.08);
          border-color: rgba(247,147,26,0.3);
        }

        .mode-icon {
          font-size: 13px;
          opacity: 0.8;
        }

        /* ── Header ── */
        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px 10px;
          border-bottom: 1px solid var(--border-subtle);
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }

        .chart-left {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }

        .cycle-label {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .cycle-name {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .cycle-stat {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--brand-orange);
          background: rgba(247,147,26,0.1);
          border: 1px solid rgba(247,147,26,0.2);
          padding: 2px 8px;
          border-radius: 4px;
        }

        /* ── Controls / checkboxes ── */
        .chart-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .check-box {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 12px;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s;
        }

        .check-box:hover {
          color: var(--text-secondary);
          background: rgba(255,255,255,0.04);
        }

        .check-box.active {
          color: var(--text-primary);
          border-color: rgba(247,147,26,0.3);
          background: rgba(247,147,26,0.06);
        }

        .check-box input {
          display: none;
        }

        .check-indicator {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 1px solid var(--border-default);
          border-radius: 3px;
          position: relative;
          flex-shrink: 0;
          transition: all 0.15s;
        }

        .check-box.active .check-indicator {
          background: var(--brand-orange);
          border-color: var(--brand-orange);
        }

        .check-box.active .check-indicator::after {
          content: '';
          position: absolute;
          inset: 2px;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 10 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4L4 7L9 1' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
        }

        /* ── Chart ── */
        .chart-area {
          position: relative;
          height: 520px;
        }

        .echarts-canvas {
          width: 100%;
          height: 520px;
          transition: opacity 0.3s;
        }

        .chart-state {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 13px;
          z-index: 10;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border-subtle);
          border-top-color: var(--brand-orange);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Footer ── */
        .chart-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          border-top: 1px solid var(--border-subtle);
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}
