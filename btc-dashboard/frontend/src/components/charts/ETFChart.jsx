import { useRef, useState, useEffect, useMemo, useCallback } from 'react';

const PERIODS = [
  { label: '1A', months: 12 },
  { label: '2A', months: 24 },
  { label: 'Todo', months: null },
];

const ETFS = ['IBIT','FBTC','BITB','ARKB','BTCO','EZBC','BRRR','HODL','BTCW','GBTC','BTC'];

const ETF_COLORS = [
  '#f7931a', '#3b82f6', '#22c55e', '#a855f7', '#ec4899',
  '#06b6d4', '#eab308', '#ef4444', '#8b5cf6', '#6366f1', '#14b8a6',
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
function formatFlowUsd(v) {
  const abs = Math.abs(v);
  const s   = v >= 0 ? '+' : '-';
  if (abs >= 1e9) return s + '$' + (abs / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return s + '$' + (abs / 1e6).toFixed(0) + 'M';
  if (abs >= 1e3) return s + '$' + (abs / 1e3).toFixed(0) + 'k';
  return s + '$' + abs.toFixed(0);
}
function formatFlowBtc(v) {
  const abs = Math.abs(v);
  const s   = v >= 0 ? '+' : '-';
  if (abs >= 1000) return s + (abs / 1000).toFixed(1) + 'k';
  return s + abs.toFixed(0);
}

export default function ETFChart({ etfData, loading, error }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const [isLog, setIsLog]               = useState(true);
  const [showByTicker, setShowByTicker]  = useState(false);
  const [showFlows, setShowFlows]        = useState(false);
  const [flowUnit, setFlowUnit]          = useState('USD'); // 'USD' or 'BTC'
  const [activePeriod, setActivePeriod]  = useState('Todo');
  const [echartsReady, setEchartsReady]  = useState(false);
  const [currentZoom, setCurrentZoom]    = useState({ start: 0, end: 100 });

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  /* ─── Parse data ───
     [ts_ms, btc_price, total, IBIT, FBTC, BITB, ARKB, BTCO, EZBC, BRRR, HODL, BTCW, GBTC, BTC]
  */
  const data = useMemo(() => {
    if (!Array.isArray(etfData) || !etfData.length) return [];
    return etfData
      .filter(d => Array.isArray(d) && d.length >= 14 && d[1] > 0)
      .map(d => {
        const date = new Date(d[0]).toISOString().split('T')[0];
        const etfHoldings = {};
        ETFS.forEach((ticker, i) => { etfHoldings[ticker] = d[3 + i]; });
        return { date, ts: d[0], btcPrice: d[1], totalHoldings: d[2], etfHoldings };
      });
  }, [etfData]);

  /* ─── Weekly flows ───
     Group daily data by ISO week.
     Flow BTC = last day holdings - first day holdings of the week.
     Flow USD = sum of daily (delta_holdings * price) for each day.
  */
  const weeklyFlows = useMemo(() => {
    if (data.length < 2) return [];

    // Group by week (Monday-based)
    const weeks = [];
    let currentWeek = null;

    for (let i = 0; i < data.length; i++) {
      const d   = data[i];
      const dt  = new Date(d.ts);
      // Get Monday of this week
      const day = dt.getUTCDay();
      const mon = new Date(d.ts - ((day === 0 ? 6 : day - 1)) * 86400000);
      const weekKey = mon.toISOString().split('T')[0];

      if (!currentWeek || currentWeek.key !== weekKey) {
        currentWeek = { key: weekKey, days: [] };
        weeks.push(currentWeek);
      }
      currentWeek.days.push({ ...d, idx: i });
    }

    return weeks.map(w => {
      const first = w.days[0];
      const last  = w.days[w.days.length - 1];
      const flowBtc = last.totalHoldings - first.totalHoldings;

      // Compute USD flow: sum daily deltas × daily price
      let flowUsd = 0;
      for (let j = 0; j < w.days.length; j++) {
        const today = w.days[j];
        // For first day of dataset, use flow vs 0 (or previous day)
        const prevHoldings = j === 0 && w.days[0].idx > 0
          ? data[w.days[0].idx - 1].totalHoldings
          : j === 0 ? first.totalHoldings : w.days[j - 1].totalHoldings;
        const delta = today.totalHoldings - prevHoldings;
        flowUsd += delta * today.btcPrice;
      }

      // Use the middle date of the week for the x-axis label
      const midDate = w.days[Math.floor(w.days.length / 2)].date;
      const allDates = w.days.map(d => d.date);
      return { date: midDate, weekKey: w.key, flowBtc, flowUsd, startDate: first.date, endDate: last.date, allDates };
    });
  }, [data]);

  // Map every date to its weekly flow (for tooltip lookup on any day)
  const weekFlowByDate = useMemo(() => {
    const map = new Map();
    for (const wf of weeklyFlows) {
      for (const d of wf.allDates) map.set(d, wf);
    }
    return map;
  }, [weeklyFlows]);

  const zoomRange = useMemo(() => {
    if (!data.length) return { start: 0, end: 100 };
    const period = PERIODS.find(p => p.label === activePeriod);
    if (!period?.months) return { start: 0, end: 100 };
    const now    = Date.now();
    const fromTs = now - period.months * 30.44 * 86400000;
    const first  = data[0].ts, last = data[data.length - 1].ts;
    return { start: Math.max(0, ((fromTs - first) / (last - first)) * 100), end: 100 };
  }, [data, activePeriod]);

  /* ─── Dynamic canvas height ─── */
  const PRICE_TOP  = 16;
  const PRICE_H    = 360;
  const GAP        = 20;
  const DZ_AREA    = 56;
  const HOLDINGS_H = showByTicker ? 180 : 90;
  const FLOWS_H    = 120;

  const chartHeight = useMemo(() => {
    let h = PRICE_TOP + PRICE_H + GAP + HOLDINGS_H + DZ_AREA;
    if (showFlows) h += GAP + FLOWS_H;
    return h;
  }, [showByTicker, showFlows]);

  /* ─── Build ECharts option ─── */
  const buildOption = useCallback((z) => {
    if (!data.length) return null;

    const dates    = data.map(d => d.date);
    const totalLen = data.length;
    const startIdx = Math.max(0, Math.floor(totalLen * (z.start / 100)));
    const endIdx   = Math.min(totalLen - 1, Math.ceil(totalLen * (z.end / 100)));
    const visible  = data.slice(startIdx, endIdx + 1);

    // Price bounds
    const prices = visible.map(d => d.btcPrice);
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
    const yHoldMax = Math.max(...visible.map(d => d.totalHoldings)) * 1.15;

    const grids = [];
    const xAxes = [];
    const yAxes = [];
    const series = [];
    const xAxisIndices = [];
    let cursor = PRICE_TOP + PRICE_H + GAP;

    // ── GRID 0 — Price ──
    grids.push({ left: 72, right: 48, top: PRICE_TOP, height: PRICE_H });
    xAxes.push({
      type: 'category', data: dates, gridIndex: 0,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { show: false }, axisPointer: { label: { show: false } },
    });
    xAxisIndices.push(0);
    yAxes.push({
      type: isLog ? 'log' : 'value', ...yPriceBounds, gridIndex: 0,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: v => formatPrice(v) },
      splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
    });

    series.push({
      type: 'line', name: 'Preço BTC', xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [d.date, d.btcPrice]),
      symbol: 'none', smooth: false,
      lineStyle: { color: '#f7931a', width: 1.5 },
      emphasis: { disabled: true }, silent: true, z: 5,
    });

    // ── GRID 1 — Holdings (always visible) ──
    let holdingsGridIdx = 1;
    grids.push({ left: 72, right: 48, top: cursor, height: HOLDINGS_H });
    cursor += HOLDINGS_H + GAP;

    xAxes.push({
      type: 'category', data: dates, gridIndex: holdingsGridIdx,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: showFlows ? { show: false } : {
        color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        formatter: (val) => {
          const d = new Date(val), m = d.getMonth();
          if (m === 0) return String(d.getFullYear());
          return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m];
        },
        interval: Math.max(1, Math.floor(dates.length / 12)),
      },
      axisPointer: { label: { show: false } },
    });
    xAxisIndices.push(holdingsGridIdx);
    yAxes.push({
      type: 'value', min: 0, max: yHoldMax, gridIndex: holdingsGridIdx,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: v => formatHoldings(v) },
      splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
      name: 'BTC nos ETFs', nameLocation: 'middle', nameGap: 56,
      nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
    });

    if (showByTicker) {
      ETFS.forEach((ticker, i) => {
        series.push({
          type: 'bar', name: ticker,
          xAxisIndex: holdingsGridIdx, yAxisIndex: holdingsGridIdx,
          stack: 'etf-holdings',
          data: data.map(d => [d.date, d.etfHoldings[ticker]]),
          itemStyle: { color: ETF_COLORS[i] },
          barMaxWidth: 6,
          emphasis: { disabled: true }, silent: true, z: 2,
        });
      });
    } else {
      series.push({
        type: 'bar', name: 'BTC Holdings',
        xAxisIndex: holdingsGridIdx, yAxisIndex: holdingsGridIdx,
        data: data.map(d => [d.date, d.totalHoldings]),
        itemStyle: { color: 'rgba(247,147,26,0.35)' },
        barMaxWidth: 6,
        emphasis: { disabled: true }, silent: true, z: 2,
      });
    }

    // ── GRID 2 — Weekly flows (optional) ──
    if (showFlows && weeklyFlows.length) {
      const flowsGridIdx = grids.length;
      grids.push({ left: 72, right: 48, top: cursor, height: FLOWS_H });
      cursor += FLOWS_H + GAP;

      // Map weekly flows onto daily dates (each week's bar spans its days)
      // We place each weekly bar at the middle date of that week
      const flowBarData = dates.map(date => {
        const wf = weeklyFlows.find(w => w.date === date);
        if (!wf) return [date, null];
        const val = flowUnit === 'USD' ? wf.flowUsd : wf.flowBtc;
        return [date, val];
      });

      // Compute flow bounds from visible range
      const visibleFlows = weeklyFlows.filter(wf => {
        const wfTs = new Date(wf.date).getTime();
        return visible.length && wfTs >= visible[0].ts && wfTs <= visible[visible.length - 1].ts;
      });
      const flowVals = visibleFlows.map(wf => flowUnit === 'USD' ? wf.flowUsd : wf.flowBtc);
      const flowMax  = flowVals.length ? Math.max(Math.abs(Math.min(...flowVals)), Math.abs(Math.max(...flowVals))) * 1.15 : 1000;

      xAxes.push({
        type: 'category', data: dates, gridIndex: flowsGridIdx,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: {
          color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          formatter: (val) => {
            const d = new Date(val), m = d.getMonth();
            if (m === 0) return String(d.getFullYear());
            return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][m];
          },
          interval: Math.max(1, Math.floor(dates.length / 12)),
        },
        axisPointer: { label: { show: false } },
      });
      xAxisIndices.push(flowsGridIdx);
      yAxes.push({
        type: 'value', min: -flowMax, max: flowMax, gridIndex: flowsGridIdx,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: {
          color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          formatter: v => flowUnit === 'USD' ? formatFlowUsd(v) : formatFlowBtc(v),
        },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        name: flowUnit === 'USD' ? 'Fluxo Semanal (USD)' : 'Fluxo Semanal (BTC)',
        nameLocation: 'middle', nameGap: 56,
        nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      });

      series.push({
        type: 'bar', name: 'Fluxo Semanal',
        xAxisIndex: flowsGridIdx, yAxisIndex: flowsGridIdx,
        data: flowBarData,
        barWidth: '500%',
        barMaxWidth: 80,
        itemStyle: {
          color: (params) => {
            if (params.value == null || params.value[1] == null) return 'transparent';
            return params.value[1] >= 0 ? 'rgba(0,196,79,0.7)' : 'rgba(232,0,10,0.7)';
          },
          borderColor: '#0a0a0f',
          borderWidth: 1,
        },
        emphasis: { disabled: true }, silent: true, z: 2,
      });
    }

    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,10,20,0.92)',
        borderColor: '#2a2a50', borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        formatter: (params) => {
          if (!params?.length) return '';
          const dateStr = params[0].axisValue;
          const point   = data.find(d => d.date === dateStr);
          if (!point) return '';

          let html = `<div style="margin-bottom:4px;font-weight:600;color:#9090b0">${dateStr}</div>`;
          html += `<div style="color:#f7931a">Preço BTC: <b>${formatPriceFull(point.btcPrice)}</b></div>`;

          html += `<div style="border-top:1px solid #2a2a50;margin:4px 0;padding-top:4px">`;
          html += `<div style="color:#e8e8f0;font-weight:600">Total em ETFs: <b>${formatHoldings(point.totalHoldings)} BTC</b></div>`;
          html += `<div style="color:#9090b0">Valor Total: <b>${formatPriceFull(point.totalHoldings * point.btcPrice)}</b></div>`;

          if (showByTicker) {
            html += `<div style="border-top:1px solid #1e1e35;margin:3px 0;padding-top:3px">`;
            const sorted = ETFS
              .map(t => ({ ticker: t, val: point.etfHoldings[t] }))
              .filter(x => x.val > 0)
              .sort((a, b) => b.val - a.val)
              .slice(0, 6);
            sorted.forEach(x => {
              const color = ETF_COLORS[ETFS.indexOf(x.ticker)];
              const pct   = ((x.val / point.totalHoldings) * 100).toFixed(1);
              html += `<div style="color:${color};font-size:10px">${x.ticker}: ${formatHoldings(x.val)} (${pct}%)</div>`;
            });
            if (ETFS.filter(t => point.etfHoldings[t] > 0).length > 6) {
              html += `<div style="color:#5a5a80;font-size:9px">+ outros</div>`;
            }
            html += `</div>`;
          }
          html += `</div>`;

          if (showFlows) {
            const wf = weekFlowByDate.get(dateStr);
            if (wf) {
              const flowColor = wf.flowBtc >= 0 ? '#00c44f' : '#e8000a';
              html += `<div style="border-top:1px solid #2a2a50;margin:4px 0;padding-top:4px">`;
              html += `<div style="color:${flowColor};font-size:10px">Fluxo semanal: <b>${formatFlowBtc(wf.flowBtc)} BTC</b></div>`;
              html += `<div style="color:${flowColor};font-size:10px">≈ <b>${formatFlowUsd(wf.flowUsd)}</b></div>`;
              html += `<div style="color:#5a5a80;font-size:9px">${wf.startDate} → ${wf.endDate}</div>`;
              html += `</div>`;
            }
          }

          return html;
        },
      },
      axisPointer: { link: [{ xAxisIndex: xAxisIndices }], lineStyle: { color: '#3d3d6b' } },
      grid: grids, xAxis: xAxes, yAxis: yAxes,
      dataZoom: [
        {
          type: 'slider', xAxisIndex: xAxisIndices,
          bottom: 10, height: 36, start: z.start, end: z.end,
          borderColor: '#1e1e35', backgroundColor: 'rgba(10,10,15,0.6)',
          fillerColor: 'rgba(247,147,26,0.08)',
          handleStyle: { color: '#f7931a', borderColor: '#f7931a' },
          moveHandleStyle: { color: 'rgba(247,147,26,0.5)' },
          selectedDataBackground: { lineStyle: { color: '#f7931a', width: 1 }, areaStyle: { color: 'rgba(247,147,26,0.1)' } },
          dataBackground: { lineStyle: { color: '#252540', width: 1 }, areaStyle: { color: 'rgba(37,37,64,0.3)' } },
          textStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
          labelFormatter: (_, str) => str ? str.substring(0, 10) : '',
        },
        { type: 'inside', xAxisIndex: xAxisIndices, start: z.start, end: z.end },
      ],
      series,
    };
  }, [data, isLog, showByTicker, showFlows, flowUnit, weeklyFlows, weekFlowByDate, HOLDINGS_H]);

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
      if (option) chart.setOption(option, { notMerge: true });
      setCurrentZoom(zoomRange);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echartsReady, data.length]);

  // ─── Update ───
  useEffect(() => {
    const chart = chartInst.current;
    if (!chart || !data.length) return;
    chart.resize();
    const option = buildOption(currentZoom);
    if (option) chart.setOption(option, { notMerge: false, replaceMerge: ['series'] });
  }, [isLog, showByTicker, showFlows, flowUnit, zoomRange, currentZoom, chartHeight, buildOption]);

  const latest = data[data.length - 1];

  return (
    <div className="etf-chart-wrapper">
      <div className="chart-header">
        <div className="chart-left">
          {latest && (
            <>
              <span className="price-display">{formatPriceFull(latest.btcPrice)}</span>
              <span className="holdings-label">
                Total ETFs: <strong>{formatHoldings(latest.totalHoldings)} BTC</strong>
              </span>
              <span className="holdings-label">
                Valor: <strong>{formatPriceFull(latest.totalHoldings * latest.btcPrice)}</strong>
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
          <div className="toggle-group" title="Dividir holdings por ETF">
            <span className="toggle-label">Por Ticker</span>
            <button className={`scale-btn ${showByTicker ? 'active' : ''}`}  onClick={() => setShowByTicker(true)}>ON</button>
            <button className={`scale-btn ${!showByTicker ? 'active' : ''}`} onClick={() => setShowByTicker(false)}>OFF</button>
          </div>
          <div className="toggle-group" title="Mostrar fluxo semanal de entrada/saída">
            <span className="toggle-label">Fluxos</span>
            <button className={`scale-btn ${showFlows ? 'active' : ''}`}  onClick={() => setShowFlows(true)}>ON</button>
            <button className={`scale-btn ${!showFlows ? 'active' : ''}`} onClick={() => setShowFlows(false)}>OFF</button>
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

          {/* Toggle BTC/USD inside the flows area */}
          {showFlows && (
            <div className="flow-unit-toggle">
              <button className={`flow-unit-btn ${flowUnit === 'USD' ? 'active' : ''}`}
                onClick={() => setFlowUnit('USD')}>USD</button>
              <button className={`flow-unit-btn ${flowUnit === 'BTC' ? 'active' : ''}`}
                onClick={() => setFlowUnit('BTC')}>BTC</button>
            </div>
          )}
        </div>
      </div>

      <div className="chart-footer">
        <span>{data.length} registros · {data.length ? `${data[0].date} → ${data[data.length-1].date}` : ''}</span>
        <span>Fonte: US Spot Bitcoin ETFs · bitbo.io</span>
      </div>

      <style jsx>{`
        .etf-chart-wrapper {
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
        .holdings-label {
          font-family:var(--font-mono); font-size:11px; color:#7878c0;
        }
        .holdings-label strong { color:#9090c8; font-weight:600; }
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
        .period-btn.active, .scale-btn.active {
          color:#f7931a; background:rgba(247,147,26,0.08); font-weight:600;
        }
        .chart-body { flex:1; display:flex; position:relative; padding:8px 12px 4px; }
        .chart-area { flex:1; position:relative; }
        .chart-state {
          position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
          gap:8px; color:var(--text-muted); font-size:13px; z-index:2;
        }
        .spinner {
          width:18px; height:18px; border:2px solid #2a2a50; border-top-color:#f7931a;
          border-radius:50%; animation:spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .echarts-canvas { width:100%; }

        .flow-unit-toggle {
          position:absolute;
          bottom: 62px; right: 56px;
          display:flex;
          background:rgba(10,10,20,0.85);
          border:1px solid var(--border-subtle);
          border-radius:5px; overflow:hidden;
          z-index:3;
        }
        .flow-unit-btn {
          padding:3px 10px; font-family:var(--font-mono); font-size:9px; font-weight:500;
          letter-spacing:0.05em; color:var(--text-muted); background:none; border:none;
          border-right:1px solid var(--border-subtle); cursor:pointer;
          transition:color 0.15s, background 0.15s;
        }
        .flow-unit-btn:last-child { border-right:none; }
        .flow-unit-btn:hover { color:var(--text-primary); }
        .flow-unit-btn.active { color:#f7931a; background:rgba(247,147,26,0.1); font-weight:600; }

        .chart-footer {
          display:flex; justify-content:space-between; align-items:center;
          padding:6px 16px 10px; font-family:var(--font-mono);
          font-size:8px; color:#28283c; letter-spacing:0.02em;
        }
      `}</style>
    </div>
  );
}
