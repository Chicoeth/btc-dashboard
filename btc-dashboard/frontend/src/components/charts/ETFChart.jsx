import { useRef, useState, useEffect, useMemo, useCallback } from 'react';

const PERIODS = [
  { label: '1A', months: 12 },
  { label: '2A', months: 24 },
  { label: 'Todo', months: null },
];

const ETFS = ['IBIT','FBTC','BITB','ARKB','BTCO','EZBC','BRRR','HODL','BTCW','GBTC','BTC'];

const ETF_LABELS = {
  IBIT: 'iShares (BlackRock)', FBTC: 'Fidelity', BITB: 'Bitwise',
  ARKB: 'ARK 21Shares', BTCO: 'Invesco/Galaxy', EZBC: 'Franklin',
  BRRR: 'CoinShares', HODL: 'VanEck', BTCW: 'WisdomTree',
  GBTC: 'Grayscale Trust', BTC: 'Grayscale Mini',
};

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

export default function ETFChart({ etfData, loading, error }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const [isLog, setIsLog]               = useState(true);
  const [showHoldings, setShowHoldings]  = useState(true);
  const [showMvrv, setShowMvrv]          = useState(false);
  const [showByTicker, setShowByTicker]  = useState(false);
  const [activePeriod, setActivePeriod]  = useState('Todo');
  const [echartsReady, setEchartsReady]  = useState(false);
  const [currentZoom, setCurrentZoom]    = useState({ start: 0, end: 100 });

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  /* ─── Parse data ───
     Format: [ts_ms, btc_price, total, avg_cost, mvrv, IBIT, FBTC, BITB, ARKB, BTCO, EZBC, BRRR, HODL, BTCW, GBTC, BTC]
     Index:    0       1          2      3         4     5..15
  */
  const data = useMemo(() => {
    if (!Array.isArray(etfData) || !etfData.length) return [];
    return etfData
      .filter(d => Array.isArray(d) && d.length >= 16 && d[1] > 0)
      .map(d => {
        const date = new Date(d[0]).toISOString().split('T')[0];
        const etfHoldings = {};
        ETFS.forEach((ticker, i) => { etfHoldings[ticker] = d[5 + i]; });
        return {
          date, ts: d[0], btcPrice: d[1], totalHoldings: d[2],
          avgCost: d[3], mvrv: d[4], etfHoldings,
        };
      });
  }, [etfData]);

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
  const MVRV_H     = 110;
  const HOLDINGS_H = showByTicker ? 180 : 90;

  const chartHeight = useMemo(() => {
    let h = PRICE_TOP + PRICE_H + DZ_AREA;
    if (showMvrv)     h += GAP + MVRV_H;
    if (showHoldings) h += GAP + HOLDINGS_H;
    return h;
  }, [showMvrv, showHoldings, showByTicker]);

  /* ─── Build ECharts option ─── */
  const buildOption = useCallback((z) => {
    if (!data.length) return null;

    const dates    = data.map(d => d.date);
    const totalLen = data.length;
    const startIdx = Math.max(0, Math.floor(totalLen * (z.start / 100)));
    const endIdx   = Math.min(totalLen - 1, Math.ceil(totalLen * (z.end / 100)));
    const visible  = data.slice(startIdx, endIdx + 1);

    // Price bounds (include avgCost)
    const priceVals = visible.flatMap(d => [d.btcPrice, d.avgCost]);
    let yPriceMin = Math.min(...priceVals);
    let yPriceMax = Math.max(...priceVals);
    let yPriceBounds;
    if (isLog) {
      yPriceBounds = { min: Math.max(1, yPriceMin * 0.85), max: yPriceMax * 1.15 };
    } else {
      const pad = (yPriceMax - yPriceMin) * 0.08;
      yPriceBounds = { min: Math.max(0, yPriceMin - pad), max: yPriceMax + pad };
    }

    // Holdings bounds
    const yHoldMax = Math.max(...visible.map(d => d.totalHoldings)) * 1.15;

    // MVRV bounds
    const mvrvVals = visible.map(d => d.mvrv).filter(v => v > 0);
    const yMvrvMin = mvrvVals.length ? Math.min(...mvrvVals) : 0;
    const yMvrvMax = mvrvVals.length ? Math.max(...mvrvVals) : 2;
    const mvrvPad  = (yMvrvMax - yMvrvMin) * 0.1 || 0.1;

    // ─── Grid layout (pixel-based) ───
    const grids = [];
    const xAxes = [];
    const yAxes = [];
    const series = [];
    const xAxisIndices = [];
    let cursor = PRICE_TOP + PRICE_H + GAP;

    // GRID 0 — Price (always)
    grids.push({ left: 72, right: 48, top: PRICE_TOP, height: PRICE_H });
    xAxes.push({
      type: 'category', data: dates, gridIndex: 0,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { show: false }, axisPointer: { label: { show: false } },
    });
    xAxisIndices.push(0);
    yAxes.push({
      type: isLog ? 'log' : 'value',
      ...yPriceBounds,
      gridIndex: 0,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: {
        color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        formatter: v => formatPrice(v),
      },
      splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
    });

    // Series — BTC Price (orange line)
    series.push({
      type: 'line', name: 'Preço BTC', xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [d.date, d.btcPrice]),
      symbol: 'none', smooth: false,
      lineStyle: { color: '#f7931a', width: 1.5 },
      emphasis: { disabled: true }, silent: true, z: 5,
    });

    // Series — Avg Cost (dashed line, same grid as price)
    series.push({
      type: 'line', name: 'Custo Médio ETFs', xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [d.date, d.avgCost]),
      symbol: 'none', smooth: false,
      lineStyle: { color: '#7878c0', width: 1.5, type: 'dashed' },
      emphasis: { disabled: true }, silent: true, z: 4,
    });

    let nextGrid = 1;

    // GRID — MVRV (optional)
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
        type: 'value',
        min: Math.max(0, yMvrvMin - mvrvPad),
        max: yMvrvMax + mvrvPad,
        gridIndex: gi,
        name: 'MVRV ETFs', nameLocation: 'middle', nameGap: 56,
        nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: v => v.toFixed(1) },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
      });

      series.push({
        type: 'line', name: 'ETF MVRV', xAxisIndex: gi, yAxisIndex: gi,
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

    // GRID — Holdings (optional)
    if (showHoldings) {
      const gi = nextGrid++;
      grids.push({ left: 72, right: 48, top: cursor, height: HOLDINGS_H });
      cursor += HOLDINGS_H + GAP;

      xAxes.push({
        type: 'category', data: dates, gridIndex: gi,
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
      xAxisIndices.push(gi);
      yAxes.push({
        type: 'value', min: 0, max: yHoldMax, gridIndex: gi,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: {
          color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          formatter: v => formatHoldings(v),
        },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        name: 'BTC nos ETFs', nameLocation: 'middle', nameGap: 56,
        nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      });

      if (showByTicker) {
        ETFS.forEach((ticker, i) => {
          series.push({
            type: 'bar', name: ETF_LABELS[ticker] || ticker,
            xAxisIndex: gi, yAxisIndex: gi,
            stack: 'etf-holdings',
            data: data.map(d => [d.date, d.etfHoldings[ticker]]),
            itemStyle: { color: ETF_COLORS[i % ETF_COLORS.length] },
            barMaxWidth: 6,
            emphasis: { disabled: true }, silent: true, z: 2,
          });
        });
      } else {
        series.push({
          type: 'bar', name: 'BTC Holdings', xAxisIndex: gi, yAxisIndex: gi,
          data: data.map(d => [d.date, d.totalHoldings]),
          itemStyle: { color: 'rgba(247,147,26,0.35)' },
          barMaxWidth: 6,
          emphasis: { disabled: true }, silent: true, z: 2,
        });
      }
    }

    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,10,20,0.92)',
        borderColor: '#2a2a50',
        borderWidth: 1,
        textStyle: { color: '#e8e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        formatter: (params) => {
          if (!params?.length) return '';
          const dateStr = params[0].axisValue;
          const point   = data.find(d => d.date === dateStr);
          if (!point) return '';

          let html = `<div style="margin-bottom:4px;font-weight:600;color:#9090b0">${dateStr}</div>`;
          html += `<div style="color:#f7931a">Preço BTC: <b>${formatPriceFull(point.btcPrice)}</b></div>`;
          html += `<div style="color:#7878c0">Custo Médio: <b>${formatPriceFull(point.avgCost)}</b></div>`;

          // P&L %
          const plPct   = ((point.btcPrice / point.avgCost) - 1) * 100;
          const plColor = plPct >= 0 ? '#00c44f' : '#e8000a';
          const plSign  = plPct >= 0 ? '+' : '';
          html += `<div style="color:${plColor}">P&L: <b>${plSign}${plPct.toFixed(1)}%</b></div>`;

          if (showMvrv) {
            html += `<div style="color:#9090b0;margin-top:2px">MVRV ETFs: <b>${point.mvrv.toFixed(3)}</b></div>`;
          }

          if (showHoldings) {
            html += `<div style="border-top:1px solid #2a2a50;margin:4px 0;padding-top:4px">`;
            html += `<div style="color:#e8e8f0;font-weight:600">Total em ETFs: <b>${formatHoldings(point.totalHoldings)} BTC</b></div>`;

            const totalValue = point.totalHoldings * point.btcPrice;
            html += `<div style="color:#9090b0">Valor Total: <b>${formatPriceFull(totalValue)}</b></div>`;

            // P&L absoluto
            const totalCost = point.totalHoldings * point.avgCost;
            const plUsd     = totalValue - totalCost;
            const plUsdC    = plUsd >= 0 ? '#00c44f' : '#e8000a';
            const plUsdSign = plUsd >= 0 ? '+' : '';
            html += `<div style="color:${plUsdC}">Lucro/Prejuízo: <b>${plUsdSign}${formatPriceFull(plUsd)}</b></div>`;

            if (showByTicker) {
              html += `<div style="border-top:1px solid #1e1e35;margin:3px 0;padding-top:3px">`;
              const sorted = ETFS
                .map(t => ({ ticker: t, val: point.etfHoldings[t] }))
                .filter(x => x.val > 0)
                .sort((a, b) => b.val - a.val)
                .slice(0, 5);
              sorted.forEach(x => {
                const color = ETF_COLORS[ETFS.indexOf(x.ticker)];
                const pct   = ((x.val / point.totalHoldings) * 100).toFixed(1);
                html += `<div style="color:${color};font-size:10px">${x.ticker}: ${formatHoldings(x.val)} (${pct}%)</div>`;
              });
              if (ETFS.filter(t => point.etfHoldings[t] > 0).length > 5) {
                html += `<div style="color:#5a5a80;font-size:9px">+ outros</div>`;
              }
              html += `</div>`;
            }
            html += `</div>`;
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
          { type: 'rect', shape: { width: 264, height: 20, r: 4 }, style: { fill: 'rgba(10,10,20,0.72)', stroke: 'rgba(120,120,192,0.3)', lineWidth: 1 } },
          { type: 'line', shape: { x1: 10, y1: 10, x2: 30, y2: 10 }, style: { stroke: '#7878c0', lineWidth: 1.5, lineDash: [4, 3] } },
          { type: 'text', left: 36, top: 3, style: { text: 'Linha tracejada = Custo Médio dos ETFs', fill: '#9090c8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' } },
        ],
      }],
      series,
    };
  }, [data, isLog, showHoldings, showMvrv, showByTicker, HOLDINGS_H]);

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
  }, [isLog, showHoldings, showMvrv, showByTicker, zoomRange, currentZoom, chartHeight, buildOption]);

  const latest  = data[data.length - 1];
  const plPct   = latest ? ((latest.btcPrice / latest.avgCost) - 1) * 100 : 0;
  const plColor = plPct >= 0 ? '#00c44f' : '#e8000a';

  return (
    <div className="etf-chart-wrapper">
      <div className="chart-header">
        <div className="chart-left">
          {latest && (
            <>
              <span className="price-display">{formatPriceFull(latest.btcPrice)}</span>
              <span className="strategy-badge" style={{
                color: plColor,
                background: plPct >= 0 ? 'rgba(0,196,79,0.1)' : 'rgba(232,0,10,0.1)',
                borderColor: plPct >= 0 ? 'rgba(0,196,79,0.3)' : 'rgba(232,0,10,0.3)',
              }}>
                MVRV {latest.mvrv.toFixed(3)}
              </span>
              <span className="cost-label">
                Custo Médio: <strong>{formatPriceFull(latest.avgCost)}</strong>
              </span>
              <span className="holdings-label">
                Total: <strong>{formatHoldings(latest.totalHoldings)} BTC</strong>
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
          <div className="toggle-group" title="Mostrar/ocultar MVRV">
            <span className="toggle-label">MVRV</span>
            <button className={`scale-btn ${showMvrv ? 'active' : ''}`}  onClick={() => setShowMvrv(true)}>ON</button>
            <button className={`scale-btn ${!showMvrv ? 'active' : ''}`} onClick={() => setShowMvrv(false)}>OFF</button>
          </div>
          {showHoldings && (
            <div className="toggle-group" title="Dividir holdings por ETF">
              <span className="toggle-label">Por Ticker</span>
              <button className={`scale-btn ${showByTicker ? 'active' : ''}`}  onClick={() => setShowByTicker(true)}>ON</button>
              <button className={`scale-btn ${!showByTicker ? 'active' : ''}`} onClick={() => setShowByTicker(false)}>OFF</button>
            </div>
          )}
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
        .period-btn.active, .scale-btn.active {
          color:#f7931a; background:rgba(247,147,26,0.08); font-weight:600;
        }
        .chart-body {
          flex:1; display:flex; position:relative;
          padding:8px 12px 4px;
        }
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
        .chart-footer {
          display:flex; justify-content:space-between; align-items:center;
          padding:6px 16px 10px; font-family:var(--font-mono);
          font-size:8px; color:#28283c; letter-spacing:0.02em;
        }
      `}</style>
    </div>
  );
}
