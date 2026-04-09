/**
 * CycleChart.jsx — Comparador de Ciclos (v3)
 * Correções: cores explícitas, eixo Y dinâmico, seletor de período
 */

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useTheme } from '../ThemeContext';
import { patchOption } from '../chartThemeHelper';

// Ciclo atual sempre laranja; demais em ordem fixa
const PALETTE = ['#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6'];
const ORANGE   = '#f7931a';
const MEAN_COLOR = '#e8e8f0';

function getCycleColor(index, total) {
  if (index === total - 1) return ORANGE; // atual = laranja
  return PALETTE[index % PALETTE.length];
}

// ─── Definições de ciclos ──────────────────────────────────────────────────

const ANCHOR_PRICES = {
  '2011-11-17': 1.99,   '2013-12-04': 1240,
  '2015-01-14': 166.45, '2017-12-17': 19804,
  '2018-12-15': 3124.5, '2021-11-10': 68997,
  '2022-11-21': 15473,  '2025-10-06': 126219,
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

// Opções de período por modo (dias)
const PERIOD_OPTIONS = {
  bull:    [{ label: '1A', days: 365 }, { label: '2A', days: 730 }, { label: '3A', days: 1095 }, { label: 'Todo', days: null }],
  bear:    [{ label: '100d', days: 100 }, { label: '200d', days: 200 }, { label: '300d', days: 300 }, { label: '400d', days: 400 }, { label: 'Todo', days: null }],
  halving: [{ label: '1A', days: 365 }, { label: '2A', days: 730 }, { label: '3A', days: 1095 }, { label: '4A', days: 1460 }, { label: 'Todo', days: null }],
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function dateToMs(d)  { return new Date(d + 'T00:00:00Z').getTime(); }
function msToDate(ms) { return new Date(ms).toISOString().split('T')[0]; }

function fmtMultiple(v) {
  if (v >= 100) return v.toFixed(0) + 'x';
  if (v >= 10)  return v.toFixed(1) + 'x';
  return v.toFixed(2) + 'x';
}

function buildPriceMap(priceData) {
  const map = new Map();
  for (const [ts, close] of priceData) map.set(msToDate(ts), close);
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
    const d = Math.round((ts - startMs) / 86400000);
    if (d === 0) continue;
    points.push([d, close / startPrice]);
  }
  if (endDate) {
    const ep = getPrice(priceMap, endDate, priceData);
    if (ep) points.push([Math.round((dateToMs(endDate) - startMs) / 86400000), ep / startPrice]);
  }
  const seen = new Set();
  return points.filter(([d]) => { if (seen.has(d)) return false; seen.add(d); return true; }).sort((a, b) => a[0] - b[0]);
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
    const d = Math.round((ts - startMs) / 86400000);
    if (d === 0) continue;
    points.push([d, close / startPrice]);
  }
  if (endDate) {
    const ep = getPrice(priceMap, endDate, priceData);
    if (ep) points.push([Math.round((dateToMs(endDate) - startMs) / 86400000), ep / startPrice]);
  }
  const seen = new Set();
  return points.filter(([d]) => { if (seen.has(d)) return false; seen.add(d); return true; }).sort((a, b) => a[0] - b[0]);
}

// Calcula média e ±1σ. Ciclos terminados mantêm último valor (evita spikes).
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
      for (const p of series) { if (p[0] <= d) before = p; else if (!after) after = p; }
      if (!before && !after) return null;
      if (!before) return after[1];
      if (!after)  return before[1]; // mantém último valor
      const t = (d - before[0]) / (after[0] - before[0]);
      return before[1] + t * (after[1] - before[1]);
    }).filter(v => v !== null);
    if (!vals.length) continue;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = vals.length > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length) : 0;
    mean.push([d, avg]);
    upper.push([d, avg + std]);
    lower.push([d, Math.max(0.001, avg - std)]);
  }
  return { mean, upper, lower };
}

// SVG checkmark as a data URI (extracted to avoid breaking styled-jsx parser)
const CHECKMARK_SVG = "data:image/svg+xml,%3Csvg viewBox='0 0 10 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4L4 7L9 1' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

// ─── Componente ────────────────────────────────────────────────────────────

export default function CycleChart({ priceData, loading, error }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  const { isDark } = useTheme();

  const [mode, setMode]                     = useState('halving');
  const [showMean, setShowMean]             = useState(false);
  const [showStd,  setShowStd]              = useState(false);
  const [echartsReady, setEchartsReady]     = useState(false);
  const [legendSelected, setLegendSelected] = useState({});
  const [xPeriod, setXPeriod]               = useState(null); // null = Todo

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  // Reseta ao trocar de modo — Ciclo 1 começa desmarcado no modo de alta
  useEffect(() => {
    setLegendSelected(mode === 'bull' ? { 'Ciclo 1': false } : {});
    setXPeriod(null);
  }, [mode]);

  const priceMap = useMemo(() => {
    if (!priceData?.length) return new Map();
    return buildPriceMap(priceData);
  }, [priceData]);

  const { cycleDefs, seriesList } = useMemo(() => {
    if (!priceData?.length) return { cycleDefs: [], seriesList: [] };
    if (mode === 'bull')    return { cycleDefs: BULL_CYCLES,    seriesList: BULL_CYCLES.map(c    => buildCycleSeries(priceData, priceMap, c.start, c.end, c.startPrice)) };
    if (mode === 'bear')    return { cycleDefs: BEAR_CYCLES,    seriesList: BEAR_CYCLES.map(c    => buildCycleSeries(priceData, priceMap, c.start, c.end, c.startPrice)) };
    return                         { cycleDefs: HALVING_CYCLES, seriesList: HALVING_CYCLES.map(c => buildHalvingSeries(priceData, priceMap, c.start, c.end)) };
  }, [priceData, priceMap, mode]);

  const { mean, upper, lower } = useMemo(() => {
    if (!showMean || seriesList.length < 2) return { mean: [], upper: [], lower: [] };

    // Exclui apenas o ciclo ATUAL (end: null = ainda em andamento)
    // Ciclos já finalizados entram no cálculo, mesmo que sejam o último do array
    const completedSeries = seriesList.filter((_, i) => cycleDefs[i]?.end !== null);
    const completedDefs   = cycleDefs.filter(c => c.end !== null);

    const active = completedSeries.filter((_, i) =>
      legendSelected[completedDefs[i]?.label] !== false
    );

    if (!active.length) return { mean: [], upper: [], lower: [] };
    return buildMeanStdDev(active);
  }, [seriesList, cycleDefs, showMean, legendSelected]);

  const buildOption = useCallback(() => {
    if (!priceData?.length || !cycleDefs.length) return null;

    const total = cycleDefs.length;

    // ── Limites do eixo X ──
    const xMaxData = Math.max(...seriesList.map(s => s[s.length - 1]?.[0] ?? 0));
    const xMax = xPeriod != null ? xPeriod : xMaxData + Math.round(xMaxData * 0.02);

    // ── Limites do eixo Y (apenas séries visíveis e dentro do xPeriod) ──
    let yMin = Infinity, yMax = -Infinity;
    cycleDefs.forEach((c, i) => {
      if (legendSelected[c.label] === false) return;
      for (const [d, v] of seriesList[i]) {
        if (d > xMax) break;
        if (v > 0) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
      }
    });
    if (showMean && mean.length) {
      for (const [d, v] of mean) {
        if (d > xMax) break;
        yMin = Math.min(yMin, v); yMax = Math.max(yMax, v);
      }
    }
    if (!isFinite(yMin)) { yMin = 0.5; yMax = 10; }

    // ── Séries principais ──
    const mainSeries = cycleDefs.map((c, i) => {
      const color = getCycleColor(i, total);
      return {
        type: 'line',
        name: c.label,
        color,
        data: seriesList[i].map(([d, v]) => [d, v]),
        smooth: false,
        symbol: 'none',
        lineStyle: {
          color,
          width: i === total - 1 ? 2 : 1.2,
        },
        itemStyle: { color },
        emphasis: { disabled: true },
        z: i === total - 1 ? 5 : 3,
      };
    });

    const extraSeries = [];

    if (showMean && mean.length) {
      const meanColor = isDark ? '#e8e8f0' : '#1a1a2e';
      extraSeries.push({
        type: 'line',
        name: 'Média',
        color: meanColor,
        data: mean.map(([d, v]) => [d, v]),
        smooth: false,
        symbol: 'none',
        lineStyle: { color: meanColor, width: 2.5, type: 'dashed' },
        itemStyle: { color: meanColor },
        emphasis: { disabled: true },
        z: 6,
      });

      if (showStd && upper.length && lower.length) {
        // Cor de masking = fundo do card (não da página)
        const maskColor = isDark ? '#111120' : '#ffffff';
        const bandLine  = isDark ? 'rgba(232,232,240,0.3)' : 'rgba(100,100,160,0.4)';
        const bandFill  = isDark ? 'rgba(232,232,240,0.1)' : 'rgba(100,100,160,0.15)';

        // Técnica de masking: upper preenche para baixo com cor da banda,
        // lower preenche para baixo com cor do fundo (apaga a parte abaixo)
        extraSeries.push({
          type: 'line',
          name: '__std_upper__',
          color: 'transparent',
          data: upper.map(([d, v]) => [d, v]),
          smooth: false, symbol: 'none',
          lineStyle: { color: bandLine, width: 1 },
          areaStyle: { color: bandFill, origin: 'auto' },
          itemStyle: { color: 'transparent' },
          z: 1, silent: true, emphasis: { disabled: true }, legendHoverLink: false,
        });
        extraSeries.push({
          type: 'line',
          name: '__std_lower__',
          color: 'transparent',
          data: lower.map(([d, v]) => [d, v]),
          smooth: false, symbol: 'none',
          lineStyle: { color: bandLine, width: 1 },
          areaStyle: { color: maskColor, origin: 'auto' },
          itemStyle: { color: 'transparent' },
          z: 2, silent: true, emphasis: { disabled: true }, legendHoverLink: false,
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
        inactiveColor: '#2a2a42',
        inactiveBorderColor: '#2a2a42',
        pageButtonItemGap: 5,
        pageTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
        formatter: name => name.startsWith('__') ? null : name,
        selectedMode: true,
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
        nameTextStyle: { color: '#9090b8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: '500' },
        axisLine: { lineStyle: { color: '#1e1e35' } },
        axisTick: { show: false },
        axisLabel: { color: '#8080a8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        min: 0,
        max: xMax,
      },
      yAxis: {
        type: 'log',
        logBase: 10,
        name: 'Retorno (normalizado em 1×)',
        nameLocation: 'middle',
        nameGap: 60,
        nameTextStyle: { color: '#9090b8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: '500' },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#8080a8',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          formatter: v => {
            if (v >= 1000) return (v / 1000).toFixed(0) + 'k×';
            if (v >= 10)   return v.toFixed(0) + '×';
            if (v >= 1)    return v.toFixed(1) + '×';
            return v.toFixed(2) + '×';
          },
        },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        min: Math.max(0.001, yMin * 0.75),
        max: yMax * 1.3,
      },
      series: [...mainSeries, ...extraSeries],
    };
  }, [cycleDefs, seriesList, showMean, showStd, mean, upper, lower, priceData, legendSelected, xPeriod, isDark]);

  // ── Init ──
  useEffect(() => {
    if (!echartsReady || !chartRef.current || !priceData?.length) return;
    const init = async () => {
      const echarts = await import('echarts');
      if (!chartInst.current) {
        const chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        chartInst.current = chart;
        new ResizeObserver(() => chart.resize()).observe(chartRef.current);
        chart.on('legendselectchanged', params => setLegendSelected({ ...params.selected }));
      }
      const option = buildOption();
      if (option) chartInst.current.setOption(patchOption(option, isDark), { notMerge: true });
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echartsReady, priceData?.length]);

  // ── Update ──
  useEffect(() => {
    const chart = chartInst.current;
    if (!chart || !priceData?.length) return;
    const option = buildOption();
    if (option) chart.setOption(patchOption(option, isDark), { notMerge: true });
  }, [buildOption, isDark]);

  const hasData      = priceData?.length > 0;
  const currentCycle = cycleDefs[cycleDefs.length - 1];
  const periods      = PERIOD_OPTIONS[mode] ?? PERIOD_OPTIONS.halving;

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

      {/* Header */}
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
        <div className="chart-right">
          {/* Seletor de período */}
          <div className="period-btns">
            {periods.map(p => (
              <button
                key={p.label}
                className={`period-btn ${xPeriod === p.days ? 'active' : ''}`}
                onClick={() => setXPeriod(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Checkboxes */}
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
      </div>

      {/* Chart */}
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
          style={{ width: '100%', height: '520px', opacity: (loading || error || !hasData) ? 0 : 1, transition: 'opacity 0.3s' }}
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

        .chart-footer {
          display:flex; align-items:center; justify-content:flex-end;
          gap:8px; padding:8px 20px; font-family:var(--font-mono);
          font-size:9px; color:var(--text-muted); flex-wrap:wrap;
        }

        .mode-selector { display: flex; gap: 8px; padding: 16px 20px 0; flex-wrap: wrap; }
        .mode-btn {
          display: flex; align-items: center; gap: 7px; padding: 9px 16px;
          font-family: var(--font-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.03em;
          color: var(--text-muted); background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-subtle); border-radius: 8px; cursor: pointer; transition: all 0.15s;
        }
        .mode-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); border-color: var(--border-default); }
        .mode-btn.active { color: var(--brand-orange); background: rgba(247,147,26,0.08); border-color: rgba(247,147,26,0.3); }
        .mode-icon { font-size: 13px; opacity: 0.8; }

        .chart-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px 10px; border-bottom: 1px solid var(--border-subtle);
          flex-wrap: wrap; gap: 10px; margin-top: 12px;
        }
        .chart-left { display: flex; align-items: baseline; gap: 10px; }
        .chart-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

        .cycle-label { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); letter-spacing: 0.06em; text-transform: uppercase; }
        .cycle-name  { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; }

        .period-btns { display: flex; gap: 4px; }
        .period-btn {
          padding: 4px 10px; font-family: var(--font-mono); font-size: 10px; font-weight: 500;
          letter-spacing: 0.04em; color: var(--text-muted); background: transparent;
          border: 1px solid var(--border-subtle); border-radius: 4px; cursor: pointer; transition: all 0.15s;
        }
        .period-btn:hover  { color: var(--text-primary); border-color: var(--border-default); }
        .period-btn.active { color: var(--brand-orange); border-color: rgba(247,147,26,0.4); background: rgba(247,147,26,0.06); }

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
          display: inline-block; width: 12px; height: 12px; border: 1px solid var(--border-default);
          border-radius: 3px; position: relative; flex-shrink: 0; transition: all 0.15s;
        }
        .check-box.active .check-indicator { background: var(--brand-orange); border-color: var(--brand-orange); }

        .chart-state {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px;
          color: var(--text-muted); font-family: var(--font-mono); font-size: 13px; z-index: 10;
        }
        .spinner {
          width: 24px; height: 24px; border: 2px solid var(--border-subtle);
          border-top-color: var(--brand-orange); border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Checkmark icon uses inline SVG URL that breaks styled-jsx parser,
          so it must be in a separate global style block */}
      <style jsx global>{`
        .cycle-chart-wrapper .check-box.active .check-indicator::after {
          content: '';
          position: absolute;
          inset: 2px;
          background: url("${CHECKMARK_SVG}") center/contain no-repeat;
        }
      `}</style>
    </div>
  );
}
