import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../ThemeContext';
import { patchOption } from '../chartThemeHelper';

const PERIODS = [
  { label: '1A', months: 12 },
  { label: '2A', months: 24 },
  { label: '3A', months: 36 },
  { label: '5A', months: 60 },
  { label: 'Todo', months: null },
];

function formatPrice(v) {
  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'k';
  return '$' + v.toFixed(0);
}
function formatPriceFull(v) {
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function formatHoldings(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(0) + 'k';
  return v.toString();
}

export default function StrategyChart({ strategyData, priceData, loading, error }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const { isDark } = useTheme();
  const [isLog, setIsLog]               = useState(true);
  const [showHoldings, setShowHoldings]  = useState(true);
  const [showMvrv, setShowMvrv]          = useState(false);
  const [showBuys, setShowBuys]          = useState(false);
  const [activePeriod, setActivePeriod]  = useState('Todo');
  const [echartsReady, setEchartsReady]  = useState(false);
  const [currentZoom, setCurrentZoom]    = useState({ start: 0, end: 100 });

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  /* ─── Daily-granularity data ───
     Strategy snapshots are sparse (only on purchase dates).
     We interpolate onto every price date using step interpolation:
     between snapshots, holdings & costBasis stay constant. */
  const data = useMemo(() => {
    if (!Array.isArray(strategyData) || !strategyData.length) return [];
    if (!Array.isArray(priceData) || !priceData.length) return [];

    const sorted = [...strategyData].sort((a, b) => a[0] - b[0]);
    const snapshots = sorted.map(s => ({ ts: s[0], holdings: s[1], costBasis: s[2] }));
    const firstTs = snapshots[0].ts;

    const result = [];
    let snapIdx = 0;

    for (const p of priceData) {
      const priceTs = p[0];
      if (priceTs < firstTs) continue;

      const btcPrice = p[1];
      const dateStr = new Date(priceTs).toISOString().split('T')[0];

      // Advance to latest snapshot <= this price date
      while (snapIdx < snapshots.length - 1 && snapshots[snapIdx + 1].ts <= priceTs) {
        snapIdx++;
      }

      const { holdings, costBasis } = snapshots[snapIdx];
      const mvrv = Math.round((btcPrice / costBasis) * 1000) / 1000;

      result.push({ date: dateStr, ts: priceTs, btcPrice, holdings, costBasis, mvrv });
    }

    return result;
  }, [strategyData, priceData]);

  // Compute purchase events: each time holdings increased between snapshots
  const purchases = useMemo(() => {
    if (!Array.isArray(strategyData) || strategyData.length < 2) return new Map();
    const sorted = [...strategyData].sort((a, b) => a[0] - b[0]);
    const buyMap = new Map(); // date string → { btcBought, priceAtBuy }
    let maxBuy = 0;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const btcBought = curr[1] - prev[1];
      if (btcBought > 0) {
        const dateStr = new Date(curr[0]).toISOString().split('T')[0];
        buyMap.set(dateStr, btcBought);
        if (btcBought > maxBuy) maxBuy = btcBought;
      }
    }
    // Also mark the first purchase
    if (sorted.length > 0) {
      const first = sorted[0];
      const dateStr = new Date(first[0]).toISOString().split('T')[0];
      buyMap.set(dateStr, first[1]);
      if (first[1] > maxBuy) maxBuy = first[1];
    }
    // Store maxBuy on the map for symbol size scaling
    buyMap._maxBuy = maxBuy;
    return buyMap;
  }, [strategyData]);

  const zoomRange = useMemo(() => {
    if (!data.length) return { start: 0, end: 100 };
    const period = PERIODS.find(p => p.label === activePeriod);
    if (!period?.months) return { start: 0, end: 100 };
    const now    = Date.now();
    const fromTs = now - period.months * 30.44 * 86400000;
    const first  = data[0].ts, last = data[data.length - 1].ts;
    return { start: Math.max(0, ((fromTs - first) / (last - first)) * 100), end: 100 };
  }, [data, activePeriod]);

  // Dynamic canvas height based on active toggles
  const chartHeight = useMemo(() => {
    let h = 16 + 360 + 56; // PRICE_TOP + PRICE_H + DZ_AREA
    if (showMvrv)     h += 20 + 110; // GAP + MVRV_H
    if (showHoldings) h += 20 + 90;  // GAP + HOLDINGS_H
    return h;
  }, [showMvrv, showHoldings]);

  const buildOption = useCallback((z) => {
    if (!data.length) return null;

    const dates = data.map(d => d.date);

    // Visible slice
    const totalLen = data.length;
    const startIdx = Math.max(0, Math.floor(totalLen * (z.start / 100)));
    const endIdx   = Math.min(totalLen - 1, Math.ceil(totalLen * (z.end / 100)));
    const visible  = data.slice(startIdx, endIdx + 1);

    // Price bounds
    const prices = visible.flatMap(d => [d.btcPrice, d.costBasis]);
    let yPriceMin = Math.min(...prices);
    let yPriceMax = Math.max(...prices);
    let yPriceBounds;
    if (isLog) {
      yPriceBounds = { min: Math.max(1, yPriceMin * 0.85), max: yPriceMax * 1.15 };
    } else {
      const pad = (yPriceMax - yPriceMin) * 0.08;
      yPriceBounds = { min: Math.max(0, yPriceMin - pad), max: yPriceMax + pad };
    }

    // Holdings bounds
    const yHoldMax = Math.max(...visible.map(d => d.holdings)) * 1.15;

    // MVRV bounds
    const mvrvVals = visible.map(d => d.mvrv);
    const yMvrvMin = Math.min(...mvrvVals);
    const yMvrvMax = Math.max(...mvrvVals);
    const mvrvPad  = (yMvrvMax - yMvrvMin) * 0.1 || 0.1;

    // ─── Grid layout (pixel-based for precise control) ───
    // Order: Price (top) → MVRV (middle, optional) → Holdings (bottom, optional)
    // Canvas height is dynamic: 520 base + 120 for MVRV + 100 for Holdings
    const grids = [];
    const xAxes = [];
    const yAxes = [];
    const series = [];
    const xAxisIndices = [];

    // Pixel layout: top=16, price=360px fixed, gap=20, sub-grids, dataZoom area=56px
    const PRICE_TOP = 16;
    const PRICE_H   = 360;
    const GAP        = 20;
    const DZ_AREA    = 56; // dataZoom height + bottom padding

    let cursor = PRICE_TOP + PRICE_H + GAP; // where next grid starts

    const MVRV_H     = 110;
    const HOLDINGS_H = 90;

    // GRID 0 — Price (always)
    grids.push({ left: 72, right: 48, top: PRICE_TOP, height: PRICE_H });
    xAxes.push({
      type: 'category', data: dates, gridIndex: 0,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { show: false }, axisPointer: { label: { show: false } },
    });
    xAxisIndices.push(0);
    yAxes.push({
      type: isLog ? 'log' : 'value', logBase: 10, ...yPriceBounds, gridIndex: 0,
      name: 'Preço (USD)', nameLocation: 'middle', nameGap: 56,
      nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: formatPrice },
      splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
    });

    // BTC Price (orange)
    series.push({
      type: 'line', name: 'Preço BTC', xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [d.date, d.btcPrice]),
      symbol: 'none', smooth: false,
      lineStyle: { color: '#f7931a', width: 1.5 },
      emphasis: { disabled: true }, silent: true, z: 3,
    });

    // Cost Basis (dashed)
    series.push({
      type: 'line', name: 'Custo Médio Strategy', xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [d.date, d.costBasis]),
      symbol: 'none', smooth: false,
      lineStyle: { color: '#7878c0', width: 1.5, type: 'dashed' },
      emphasis: { disabled: true }, silent: true, z: 2,
    });

    // Purchase markers (scatter on price grid)
    if (showBuys && purchases.size > 1) {
      const maxBuy = purchases._maxBuy || 1;
      const MIN_SIZE = 6;
      const MAX_SIZE = 22;

      const buyData = [];
      for (const d of data) {
        const bought = purchases.get(d.date);
        if (bought && bought > 0) {
          const ratio = bought / maxBuy;
          const size = MIN_SIZE + ratio * (MAX_SIZE - MIN_SIZE);
          buyData.push({
            value: [d.date, d.btcPrice],
            symbolSize: Math.round(size),
            _btcBought: bought,
          });
        }
      }

      series.push({
        type: 'scatter', name: 'Compras',
        xAxisIndex: 0, yAxisIndex: 0,
        data: buyData,
        itemStyle: {
          color: 'rgba(0,196,79,0.7)',
          borderColor: '#00c44f',
          borderWidth: 1,
        },
        emphasis: {
          itemStyle: {
            color: 'rgba(0,196,79,0.9)',
            borderColor: '#00ff5a',
            borderWidth: 2,
          },
        },
        z: 10,
      });
    }

    let nextGrid = 1;

    // GRID — MVRV (optional, between price and holdings)
    if (showMvrv) {
      const gi = nextGrid++;
      grids.push({ left: 72, right: 48, top: cursor, height: MVRV_H });
      cursor += MVRV_H + GAP;

      xAxes.push({
        type: 'category', data: dates, gridIndex: gi,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { show: false }, axisPointer: { label: { show: false } },
      });
      xAxisIndices.push(gi);
      yAxes.push({
        type: 'value', min: Math.max(0, yMvrvMin - mvrvPad), max: yMvrvMax + mvrvPad,
        gridIndex: gi,
        name: 'MVRV Strategy', nameLocation: 'middle', nameGap: 56,
        nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: v => v.toFixed(1) },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
      });

      series.push({
        type: 'line', name: 'Strategy MVRV', xAxisIndex: gi, yAxisIndex: gi,
        data: data.map(d => [d.date, d.mvrv]),
        symbol: 'none', smooth: false,
        lineStyle: { color: '#9090b0', width: 1.5 },
        emphasis: { disabled: true }, silent: true, z: 3,
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { color: '#5a5a80', type: 'dashed', width: 1 },
          label: { show: true, position: 'insideEndTop', formatter: '1.0', color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 9 },
          data: [{ yAxis: 1.0 }],
        },
      });
    }

    // GRID — Holdings (optional, always last / bottom)
    if (showHoldings) {
      const gi = nextGrid++;
      grids.push({ left: 72, right: 48, top: cursor, height: HOLDINGS_H });
      cursor += HOLDINGS_H + GAP;

      xAxes.push({
        type: 'category', data: dates, gridIndex: gi,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { show: false }, axisPointer: { label: { show: false } },
      });
      xAxisIndices.push(gi);
      yAxes.push({
        type: 'value', min: 0, max: yHoldMax, gridIndex: gi,
        name: 'Holdings (BTC)', nameLocation: 'middle', nameGap: 56,
        nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: formatHoldings },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
      });

      series.push({
        type: 'bar', name: 'BTC Holdings', xAxisIndex: gi, yAxisIndex: gi,
        data: data.map(d => [d.date, d.holdings]),
        barMaxWidth: 4,
        itemStyle: { color: 'rgba(247,147,26,0.35)', borderRadius: [1, 1, 0, 0] },
        emphasis: { disabled: true }, silent: true, z: 2,
      });
    }

    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,10,20,0.92)',
        borderColor: '#1e1e35',
        textStyle: { color: '#e8e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        formatter: (params) => {
          if (!params?.length) return '';
          const date = params[0].axisValue;
          const point = data.find(d => d.date === date);
          if (!point) return date;

          const plPct = ((point.btcPrice - point.costBasis) / point.costBasis * 100).toFixed(1);
          const plC = point.btcPrice >= point.costBasis ? '#00c44f' : '#e8000a';

          let html = `<div style="margin-bottom:6px;color:#8080a8">${date}</div>`;
          html += `<div style="color:#f7931a">Preço BTC: <b>${formatPriceFull(point.btcPrice)}</b></div>`;
          html += `<div style="color:#7878c0">Custo Médio: <b>${formatPriceFull(point.costBasis)}</b></div>`;
          html += `<div style="color:${plC}">P&L: <b>${plPct}%</b></div>`;

          if (showBuys) {
            // Check exact date first, then ±3 days to catch nearby hover
            let bought = purchases.get(date);
            let buyDate = date;
            if (!bought) {
              const ts = point.ts;
              for (let offset = 1; offset <= 3; offset++) {
                const before = new Date(ts - offset * 86400000).toISOString().split('T')[0];
                const after  = new Date(ts + offset * 86400000).toISOString().split('T')[0];
                if (purchases.has(before)) { bought = purchases.get(before); buyDate = before; break; }
                if (purchases.has(after))  { bought = purchases.get(after);  buyDate = after;  break; }
              }
            }
            if (bought) {
              const label = buyDate !== date ? ` (${buyDate})` : '';
              html += `<div style="margin-top:4px;color:#00c44f">🟢 Compra${label}: <b>+${bought.toLocaleString()} BTC</b></div>`;
            }
          }

          html += `<div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(120,120,192,0.15)">`;
          html += `<div style="color:#e8e8f0;font-weight:600">Holdings: ${point.holdings.toLocaleString()} BTC</div>`;
          const totalValue = point.btcPrice * point.holdings;
          html += `<div style="color:#9090b0">Valor Total: <b>${formatPriceFull(totalValue)}</b></div>`;

          const plUsd = (point.btcPrice - point.costBasis) * point.holdings;
          const plUsdC = plUsd >= 0 ? '#00c44f' : '#e8000a';
          const plSign = plUsd >= 0 ? '+' : '';
          html += `<div style="color:${plUsdC}">Lucro/Prejuízo: <b>${plSign}${formatPriceFull(plUsd)}</b></div>`;
          html += `</div>`;

          if (showMvrv) {
            html += `<div style="color:#9090b0;margin-top:4px">MVRV Strategy: <b>${point.mvrv.toFixed(3)}</b></div>`;
          }

          return html;
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: xAxisIndices }],
        lineStyle: { color: '#3d3d6b' },
      },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      dataZoom: [
        {
          type: 'slider', xAxisIndex: xAxisIndices,
          bottom: 10, height: 36,
          start: z.start, end: z.end,
          borderColor: '#1e1e35', backgroundColor: 'rgba(10,10,15,0.6)',
          fillerColor: 'rgba(247,147,26,0.08)',
          handleStyle: { color: '#f7931a', borderColor: '#f7931a' },
          moveHandleStyle: { color: 'rgba(247,147,26,0.5)' },
          selectedDataBackground: {
            lineStyle: { color: '#f7931a', width: 1 },
            areaStyle: { color: 'rgba(247,147,26,0.1)' },
          },
          dataBackground: {
            lineStyle: { color: '#252540', width: 1 },
            areaStyle: { color: 'rgba(37,37,64,0.3)' },
          },
          textStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
          labelFormatter: (_, str) => str ? str.substring(0, 10) : '',
        },
        { type: 'inside', xAxisIndex: xAxisIndices, start: z.start, end: z.end },
      ],
      graphic: [{
        type: 'group',
        left: 80, top: 22,
        children: [
          { type: 'rect', shape: { width: 268, height: 20, r: 4 }, style: { fill: 'rgba(10,10,20,0.72)', stroke: 'rgba(120,120,192,0.3)', lineWidth: 1 } },
          { type: 'line', shape: { x1: 10, y1: 10, x2: 30, y2: 10 }, style: { stroke: '#7878c0', lineWidth: 1.5, lineDash: [4, 3] } },
          { type: 'text', left: 36, top: 3, style: { text: 'Linha tracejada = Custo Médio Strategy', fill: '#9090c8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' } },
        ],
      }],
      series,
    };
  }, [data, isLog, showHoldings, showMvrv, showBuys, purchases]);

  // ─── Init ───
  useEffect(() => {
    if (!echartsReady || !chartRef.current || !data.length) return;
    const init = async () => {
      const echarts = await import('echarts');
      let chart = chartInst.current;
      if (!chart) {
        chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        chartInst.current = chart;
        new ResizeObserver(() => chart.resize()).observe(chartRef.current);
        let zoomTimer = null;
        chart.on('datazoom', () => {
          const opt = chart.getOption();
          const dz  = opt?.dataZoom?.[0];
          if (!dz) return;
          clearTimeout(zoomTimer);
          zoomTimer = setTimeout(() => setCurrentZoom({ start: dz.start ?? 0, end: dz.end ?? 100 }), 150);
        });
      }
      const option = buildOption(zoomRange);
      if (option) chart.setOption(patchOption(option, isDark), { notMerge: true });
      setCurrentZoom(zoomRange);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echartsReady, data.length]);

  /* ─── sync currentZoom when period changes ─── */
  useEffect(() => {
    setCurrentZoom(zoomRange);
  }, [zoomRange]);

  // ─── Update ───
  useEffect(() => {
    const chart = chartInst.current;
    if (!chart || !data.length) return;
    chart.resize();
    const option = buildOption(currentZoom);
    if (option) chart.setOption(patchOption(option, isDark), { notMerge: true });
  }, [isLog, showHoldings, showMvrv, showBuys, currentZoom, buildOption, chartHeight, isDark]);

  const latest = data.length ? data[data.length - 1] : null;
  const plPercent = latest ? ((latest.btcPrice - latest.costBasis) / latest.costBasis * 100).toFixed(1) : 0;
  const plColor = latest && latest.btcPrice >= latest.costBasis ? '#00c44f' : '#e8000a';

  return (
    <div className="strategy-chart-wrapper">
      <div className="chart-header">
        <div className="chart-left">
          {latest && (
            <>
              <span className="price-display">{formatPriceFull(latest.btcPrice)}</span>
              <span className="strategy-badge" style={{
                color: plColor,
                background: plColor === '#00c44f' ? 'rgba(0,196,79,0.12)' : 'rgba(232,0,10,0.12)',
                borderColor: plColor === '#00c44f' ? 'rgba(0,196,79,0.3)' : 'rgba(232,0,10,0.3)',
              }}>
                P&L {plPercent}%
              </span>
              <span className="cost-label">
                Custo Médio: <strong>{formatPriceFull(latest.costBasis)}</strong>
              </span>
              <span className="holdings-label">
                Holdings: <strong>{latest.holdings.toLocaleString()} BTC</strong>
              </span>
            </>
          )}
        </div>
        <div className="chart-controls">
          <div className="period-selector">
            {PERIODS.map(p => (
              <button key={p.label}
                className={`period-btn ${activePeriod === p.label ? 'active' : ''}`}
                onClick={() => setActivePeriod(p.label)}>{p.label}</button>
            ))}
          </div>
          <div className="toggle-group">
            <button className={`scale-btn ${isLog ? 'active' : ''}`}   onClick={() => setIsLog(true)}>LOG</button>
            <button className={`scale-btn ${!isLog ? 'active' : ''}`}  onClick={() => setIsLog(false)}>LINEAR</button>
          </div>
          <div className="toggle-group" title="Mostrar/ocultar holdings">
            <span className="toggle-label">Holdings</span>
            <button className={`scale-btn ${showHoldings ? 'active' : ''}`}  onClick={() => setShowHoldings(true)}>ON</button>
            <button className={`scale-btn ${!showHoldings ? 'active' : ''}`} onClick={() => setShowHoldings(false)}>OFF</button>
          </div>
          <div className="toggle-group" title="Mostrar/ocultar MVRV Strategy">
            <span className="toggle-label">MVRV</span>
            <button className={`scale-btn ${showMvrv ? 'active' : ''}`}  onClick={() => setShowMvrv(true)}>ON</button>
            <button className={`scale-btn ${!showMvrv ? 'active' : ''}`} onClick={() => setShowMvrv(false)}>OFF</button>
          </div>
          <div className="toggle-group" title="Mostrar/ocultar marcadores de compra">
            <span className="toggle-label">Compras</span>
            <button className={`scale-btn ${showBuys ? 'active' : ''}`}  onClick={() => setShowBuys(true)}>ON</button>
            <button className={`scale-btn ${!showBuys ? 'active' : ''}`} onClick={() => setShowBuys(false)}>OFF</button>
          </div>
        </div>
      </div>

      <div className="chart-body">
        <div className="chart-area">
          {(loading || error || !data.length) && (
            <div className="chart-state">
              {loading && <><div className="spinner" /><span>Carregando...</span></>}
              {error   && <span style={{ color: '#ef4444' }}>⚠ {error}</span>}
              {!loading && !error && !data.length && <span>Sem dados disponíveis.</span>}
            </div>
          )}
          <div ref={chartRef} className="echarts-canvas"
            style={{ opacity: loading || error || !data.length ? 0.15 : 1, height: chartHeight + 'px' }}
          />
        </div>
      </div>

      <div className="chart-footer">
        <span>{data.length} registros</span>
        <span>·</span>
        <span>{data.length ? `${data[0].date} → ${data[data.length-1].date}` : ''}</span>
        <span>·</span>
        <span>Fonte: Strategy (MSTR) · bitbo.io</span>
      </div>

      <style jsx>{`
        .strategy-chart-wrapper {
          display:flex; flex-direction:column; height:100%;
          font-family:var(--font-body);
        }
        .chart-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; flex-wrap:wrap; gap:8px;
          border-bottom:1px solid var(--border-subtle);
        }
        .chart-left { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .price-display {
          font-family:var(--font-mono); font-size:18px; font-weight:700;
          color:var(--text-primary); letter-spacing:-0.02em;
        }
        .strategy-badge {
          font-family:var(--font-mono); font-size:11px; font-weight:600;
          padding:3px 8px; border-radius:20px; border:1px solid;
          letter-spacing:0.03em;
        }
        .cost-label, .holdings-label {
          font-family:var(--font-mono); font-size:11px; color:#7878c0;
        }
        .cost-label strong, .holdings-label strong { color:#9090c8; font-weight:600; }
        .chart-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .period-selector, .toggle-group {
          display:flex; background:rgba(255,255,255,0.03);
          border:1px solid var(--border-subtle); border-radius:6px; overflow:hidden;
        }
        .period-btn, .scale-btn {
          padding:5px 9px; font-family:var(--font-mono); font-size:10px; font-weight:500;
          letter-spacing:0.05em; color:var(--text-muted); background:none; border:none;
          border-right:1px solid var(--border-subtle); cursor:pointer;
          transition:color 0.15s, background 0.15s;
        }
        .period-btn:last-child, .scale-btn:last-child { border-right:none; }
        .toggle-label {
          padding:5px 7px; font-family:var(--font-mono); font-size:9px; font-weight:600;
          letter-spacing:0.06em; color:var(--text-muted); text-transform:uppercase;
          border-right:1px solid var(--border-subtle); user-select:none;
        }
        .period-btn:hover, .scale-btn:hover { color:var(--text-primary); background:rgba(255,255,255,0.04); }
        .period-btn.active, .scale-btn.active { color:var(--brand-orange); background:rgba(247,147,26,0.1); }
        .chart-body { flex:1; display:flex; min-height:0; }
        .chart-area { flex:1; position:relative; }
        .echarts-canvas { width:100%; transition:opacity 0.3s; }
        .chart-state {
          position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:12px;
          color:var(--text-muted); font-family:var(--font-mono); font-size:13px; z-index:10;
        }
        .spinner {
          width:24px; height:24px; border:2px solid var(--border-subtle);
          border-top-color:var(--brand-orange); border-radius:50%;
          animation:spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        .chart-footer {
          display:flex; align-items:center; justify-content:flex-end;
          gap:8px; padding:8px 20px; font-family:var(--font-mono);
          font-size:9px; color:var(--text-muted); flex-wrap:wrap;
        }
      `}</style>
    </div>
  );
}
