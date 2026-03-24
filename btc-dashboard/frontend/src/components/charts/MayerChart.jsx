import { useRef, useState, useEffect, useMemo, useCallback } from 'react';

/* ─── helpers ─── */
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PERIODS   = [
  { label: '1A', months: 12 },
  { label: '2A', months: 24 },
  { label: '3A', months: 36 },
  { label: '5A', months: 60 },
  { label: 'Todo', months: null },
];

const SMA_PERIOD = 200;

function formatPrice(v) {
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `$${v.toFixed(0)}`;
}
function formatPriceFull(v) {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function formatDateTooltip(val) {
  const d = new Date(val);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Mayer color scale ───
   ≤ 0.6  → verde puro
   0.6–2.0 → gradiente verde→amarelo→vermelho
   ≥ 2.0  → vermelho puro
*/
function mayerColor(val, alpha) {
  let r, g, b;
  if (val <= 0.6) {
    r = 0; g = 196; b = 79;
  } else if (val <= 1.0) {
    const t = (val - 0.6) / 0.4;
    r = Math.round(t * 245);
    g = 196 - Math.round(t * 0);
    b = 79 - Math.round(t * 79);
  } else if (val <= 1.5) {
    const t = (val - 1.0) / 0.5;
    r = 245;
    g = 196 - Math.round(t * 96);
    b = 0;
  } else if (val <= 2.0) {
    const t = (val - 1.5) / 0.5;
    r = 232;
    g = Math.round(100 * (1 - t));
    b = Math.round(10 * (1 - t));
  } else {
    r = 232; g = 0; b = 10;
  }
  if (alpha !== undefined) return `rgba(${r},${g},${b},${alpha})`;
  return `rgb(${r},${g},${b})`;
}

/* Legenda: valores e posição % (de cima para baixo, vermelho→verde) */
const LEGEND_ITEMS = [
  { val: 3.0, pct: 0  },
  { val: 2.5, pct: 8  },
  { val: 2.0, pct: 18 },
  { val: 1.5, pct: 35 },
  { val: 1.2, pct: 50 },
  { val: 1.0, pct: 60 },
  { val: 0.8, pct: 72 },
  { val: 0.6, pct: 82 },
  { val: 0.4, pct: 92 },
  { val: 0.0, pct: 100 },
];

/* ─── Build colored line segments (preço apenas) ─── */
function buildColoredPriceSegments(rows) {
  if (!rows.length) return [];
  const THRESHOLD = 0.05;
  const series = [];
  let segStart = 0;

  for (let i = 1; i <= rows.length; i++) {
    const ended = i === rows.length
      || Math.abs(rows[i]?.mayer - rows[i - 1].mayer) > THRESHOLD;
    if (ended) {
      const start = segStart > 0 ? segStart - 1 : segStart;
      if (i - start >= 2) {
        const avgMayer = Array.from({ length: i - start }, (_, k) => rows[start + k].mayer)
          .reduce((s, v) => s + v, 0) / (i - start);
        series.push({
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: Array.from({ length: i - start }, (_, k) => [
            rows[start + k].date,
            rows[start + k].price,
          ]),
          smooth: false,
          symbol: 'none',
          lineStyle: { color: mayerColor(avgMayer), width: 1.5, cap: 'round' },
          silent: true,
          emphasis: { disabled: true },
          z: 3,
        });
      }
      segStart = i - 1;
    }
  }
  return series;
}

/* ═══════════════════════════════════════════════════════ */
export default function MayerChart({ priceData, loading, error }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  const [isLog, setIsLog]               = useState(true);
  const [coloredPrice, setColoredPrice] = useState(true);
  const [activePeriod, setActivePeriod]  = useState('Todo');
  const [echartsReady, setEchartsReady]  = useState(false);
  const [currentZoom, setCurrentZoom]    = useState({ start: 0, end: 100 });

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  /* ─── compute SMA200 & Mayer Multiple ─── */
  const data = useMemo(() => {
    if (!Array.isArray(priceData) || !priceData.length) return [];
    const sorted = [...priceData].sort((a, b) => a[0] - b[0]);
    const rows = [];
    for (let i = 0; i < sorted.length; i++) {
      const close = sorted[i][1];
      if (!close || close <= 0) continue;
      if (i < SMA_PERIOD - 1) continue;
      let sum = 0;
      for (let j = i - SMA_PERIOD + 1; j <= i; j++) sum += sorted[j][1];
      const sma200 = sum / SMA_PERIOD;
      const mayer  = close / sma200;
      rows.push({ ts: sorted[i][0], date: new Date(sorted[i][0]).toISOString().split('T')[0], price: close, sma200, mayer });
    }
    return rows;
  }, [priceData]);

  const zoomRange = useMemo(() => {
    if (!data.length) return { start: 0, end: 100 };
    const period = PERIODS.find(p => p.label === activePeriod);
    if (!period?.months) return { start: 0, end: 100 };
    const fromTs = Date.now() - period.months * 30.44 * 86400000;
    const first = data[0].ts, last = data[data.length - 1].ts;
    return { start: Math.max(0, ((fromTs - first) / (last - first)) * 100), end: 100 };
  }, [data, activePeriod]);

  const coloredPriceSeries = useMemo(
    () => coloredPrice ? buildColoredPriceSegments(data) : [],
    [data, coloredPrice]
  );

  /* ─── buildOption (useCallback!) ─── */
  const buildOption = useCallback((zoom) => {
    if (!data.length) return null;
    const z = zoom || zoomRange;
    const timestamps = data.map(d => d.date);
    const spanDays   = Math.round(((z.end - z.start) / 100) * data.length);

    const xLabelFormatter = (val) => {
      const d = new Date(val), m = d.getMonth(), y = d.getFullYear(), day = d.getDate();
      if (spanDays > 365 * 3) return m === 0 ? String(y) : '';
      if (spanDays > 180) { if (m === 0) return String(y); if (m % 3 === 0) return MONTHS_PT[m]; return ''; }
      if (spanDays > 60)  return m === 0 ? String(y) : MONTHS_PT[m];
      if (day === 1) return MONTHS_PT[m] + (m === 0 ? '\n' + y : '');
      return [8, 15, 22].includes(day) ? String(day) : '';
    };
    const xInterval = spanDays > 365 * 3 ? Math.floor(data.length / 16)
                    : spanDays > 180      ? Math.floor(spanDays / 6)
                    : spanDays > 60       ? Math.floor(spanDays / 7)
                    : 'auto';

    let yPriceBounds = {};
    if (isLog) {
      const i0 = Math.floor((z.start / 100) * (data.length - 1));
      const i1 = Math.ceil((z.end   / 100) * (data.length - 1));
      const vis = data.slice(i0, i1 + 1);
      const prices = vis.flatMap(d => [d.price, d.sma200]).filter(v => v > 0);
      if (prices.length) {
        yPriceBounds = {
          min: Math.pow(10, Math.log10(Math.min(...prices)) - 0.1),
          max: Math.pow(10, Math.log10(Math.max(...prices)) + 0.1),
        };
      }
    }

    const i0m = Math.floor((z.start / 100) * (data.length - 1));
    const i1m = Math.ceil((z.end   / 100) * (data.length - 1));
    const visM = data.slice(i0m, i1m + 1).map(d => d.mayer);
    const mayerMin = Math.max(0, Math.min(...visM) - 0.1);
    const mayerMax = Math.max(...visM) + 0.1;

    const basePriceSeries = {
      type: 'line', name: '__price__',
      xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [d.date, d.price]),
      symbol: 'none', smooth: false,
      lineStyle: { color: coloredPrice ? 'transparent' : '#f7931a', width: coloredPrice ? 0 : 1.5 },
      areaStyle: coloredPrice ? undefined : {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(247,147,26,0.08)' },
            { offset: 1, color: 'rgba(247,147,26,0)' },
          ],
        },
      },
      z: 1,
    };

    const sma200Series = {
      type: 'line', name: '__sma200__',
      xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [d.date, d.sma200]),
      symbol: 'none', smooth: false,
      lineStyle: { color: '#7878c0', width: 1.5, type: 'dashed' },
      emphasis: { disabled: true }, silent: true, z: 2,
    };

    // base Mayer series — invisível, para tooltip
    const baseMayerSeries = {
      type: 'line', name: '__mayer__',
      xAxisIndex: 1, yAxisIndex: 1,
      data: data.map(d => [d.date, d.mayer]),
      symbol: 'none', smooth: false,
      lineStyle: { color: 'transparent', width: 0 },
      z: 1,
    };

    // Linha cinza do Mayer (padrão igual ao MVRV)
    const mayerLine = {
      type: 'line', name: '__mayer_line__',
      xAxisIndex: 1, yAxisIndex: 1,
      data: data.map(d => [d.date, d.mayer]),
      symbol: 'none', smooth: false,
      lineStyle: { color: '#9090b0', width: 1.5 },
      emphasis: { disabled: true }, silent: true, z: 5,
    };

    return {
      animation: false,
      grid: [
        { left: 72, right: 48, top: 16, height: '55%' },
        { left: 72, right: 48, top: '74%', height: '15%' },
      ],
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(10,10,20,0.92)',
        borderColor: '#252540',
        padding: [10, 14],
        textStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
        formatter(params) {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = data.findIndex(d => d.date === p.axisValue);
          const row = idx >= 0 ? data[idx] : null;
          if (!row) return '';
          const color = mayerColor(row.mayer);
          return `
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#9090b0;margin-bottom:6px">${formatDateTooltip(row.date)}</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#9090b0;font-size:11px">Preço BTC</span>
                <span style="color:#e8e8f0;font-size:12px;font-weight:600">${formatPriceFull(row.price)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#9090b0;font-size:11px">SMA 200</span>
                <span style="color:#7878c0;font-size:12px">${formatPriceFull(row.sma200)}</span>
              </div>
              <div style="margin-top:2px;padding-top:6px;border-top:1px solid #252540;display:flex;justify-content:space-between;gap:16px">
                <span style="color:#9090b0;font-size:11px">Múltiplo de Mayer</span>
                <span style="color:${color};font-size:16px;font-weight:700">${row.mayer.toFixed(3)}</span>
              </div>
            </div>
          `;
        },
      },
      xAxis: [
        {
          type: 'category', data: timestamps, gridIndex: 0,
          axisLine: { lineStyle: { color: '#1e1e35' } }, axisTick: { show: false },
          axisLabel: { show: false }, splitLine: { show: false }, boundaryGap: false,
        },
        {
          type: 'category', data: timestamps, gridIndex: 1,
          axisLine: { lineStyle: { color: '#1e1e35' } }, axisTick: { show: false },
          axisLabel: {
            color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            margin: 10, interval: xInterval, formatter: xLabelFormatter,
          },
          splitLine: { show: false }, boundaryGap: false,
        },
      ],
      yAxis: [
        {
          type: isLog ? 'log' : 'value', logBase: 10,
          ...(isLog ? yPriceBounds : { scale: true }),
          gridIndex: 0,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: formatPrice },
          splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        },
        {
          type: 'value', gridIndex: 1,
          min: mayerMin, max: mayerMax,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: (v) => v.toFixed(1) },
          splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        },
      ],
      dataZoom: [
        {
          type: 'slider', xAxisIndex: [0, 1],
          bottom: 10, height: 36,
          start: z.start, end: z.end,
          borderColor: '#1e1e35',
          backgroundColor: 'rgba(10,10,15,0.6)',
          fillerColor: 'rgba(247,147,26,0.08)',
          handleStyle: { color: '#f7931a', borderColor: '#f7931a' },
          moveHandleStyle: { color: 'rgba(247,147,26,0.5)' },
          selectedDataBackground: {
            lineStyle: { color: '#f7931a', width: 1.5 },
            areaStyle: { color: 'rgba(247,147,26,0.15)' },
          },
          dataBackground: {
            lineStyle: { color: '#252540', width: 1 },
            areaStyle: { color: 'rgba(37,37,64,0.4)' },
          },
          textStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
          labelFormatter(val, str) { return str ? str.substring(0, 10) : ''; },
        },
        { type: 'inside', xAxisIndex: [0, 1], start: z.start, end: z.end },
      ],
      graphic: [{
        type: 'group', left: 80, top: 22,
        children: [
          { type: 'rect', shape: { width: 220, height: 20, r: 4 }, style: { fill: 'rgba(10,10,20,0.72)', stroke: 'rgba(120,120,192,0.3)', lineWidth: 1 } },
          { type: 'line', shape: { x1: 10, y1: 10, x2: 30, y2: 10 }, style: { stroke: '#7878c0', lineWidth: 1.5, lineDash: [4, 3] } },
          { type: 'text', left: 36, top: 3, style: { text: 'Linha tracejada = SMA 200 dias', fill: '#9090c8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' } },
        ],
      }],
      series: [
        basePriceSeries,
        sma200Series,
        baseMayerSeries,
        mayerLine,
        ...(coloredPrice ? coloredPriceSeries : []),
      ],
    };
  }, [data, isLog, coloredPrice, zoomRange, coloredPriceSeries]);

  /* ─── init chart ─── */
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

  /* ─── update chart ─── */
  useEffect(() => {
    const chart = chartInst.current;
    if (!chart || !data.length) return;
    const option = buildOption(currentZoom);
    if (option) chart.setOption(option, { notMerge: false, replaceMerge: ['series'] });
  }, [isLog, coloredPrice, zoomRange, currentZoom, buildOption]);

  const latest      = data.length ? data[data.length - 1] : null;
  const latestColor = latest ? mayerColor(latest.mayer) : '#9090b0';

  return (
    <div className="mayer-chart-wrapper">
      <div className="chart-header">
        <div className="chart-left">
          {latest && (
            <>
              <span className="price-display">{formatPriceFull(latest.price)}</span>
              <span className="mayer-badge" style={{
                color: latestColor,
                background: mayerColor(latest.mayer, 0.12),
                borderColor: mayerColor(latest.mayer, 0.3),
              }}>
                Mayer {latest.mayer.toFixed(3)}
              </span>
              <span className="sma-label">
                SMA 200: <strong>{formatPriceFull(latest.sma200)}</strong>
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
          <div className="toggle-group" title="Cor do gráfico de preços">
            <span className="toggle-label">Preço</span>
            <button className={`scale-btn ${coloredPrice ? 'active' : ''}`}  onClick={() => setColoredPrice(true)}>COR</button>
            <button className={`scale-btn ${!coloredPrice ? 'active' : ''}`} onClick={() => setColoredPrice(false)}>SEM COR</button>
          </div>
        </div>
      </div>

      <div className="chart-body">
        <div className="chart-area">
          {(loading || error || !data.length) && (
            <div className="chart-state">
              {loading && <><div className="spinner" /><span>Carregando...</span></>}
              {error   && <span style={{ color: '#ef4444' }}>⚠ {error}</span>}
              {!loading && !error && !data.length && (
                <span>Sem dados. Execute <code>node scripts/fetch-history.mjs</code></span>
              )}
            </div>
          )}
          <div ref={chartRef} className="echarts-canvas"
            style={{ opacity: loading || error || !data.length ? 0 : 1, height: '520px' }} />
        </div>

        {/* Legenda lateral — barra + labels posicionados ao lado */}
        <div className="legend">
          <div className="legend-track">
            <div className="legend-bar" />
            {LEGEND_ITEMS.map(item => (
              <span key={item.val} className="legend-val"
                style={{ top: `${item.pct}%`, color: mayerColor(item.val) }}>
                {item.val.toFixed(1)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {data.length > 0 && (
        <div className="chart-footer">
          <span>{data.length.toLocaleString('pt-BR')} dias de dados</span>
          <span>·</span>
          <span>
            {new Date(data[0].ts).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            {' → '}
            {new Date(data[data.length - 1].ts).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
          </span>
          <span>·</span>
          <span>Fonte: Yahoo Finance</span>
        </div>
      )}

      <style jsx>{`
        .mayer-chart-wrapper { display:flex; flex-direction:column; height:100%; }
        .chart-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:14px 20px 12px; border-bottom:1px solid var(--border-subtle);
          flex-wrap:wrap; gap:10px;
        }
        .chart-left { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }
        .price-display {
          font-family:var(--font-display); font-size:22px; font-weight:700;
          color:var(--text-primary); letter-spacing:-0.02em;
        }
        .mayer-badge {
          font-family:var(--font-mono); font-size:12px; font-weight:600;
          padding:3px 10px; border-radius:20px; border:1px solid; letter-spacing:0.03em;
        }
        .sma-label {
          font-family:var(--font-mono); font-size:11px; color:#7878c0;
        }
        .sma-label strong { color:#9090c8; font-weight:600; }
        .chart-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .period-selector { display:flex; gap:2px; }
        .period-btn {
          font-family:var(--font-mono); font-size:10px; font-weight:500;
          padding:4px 10px; border-radius:4px;
          background:transparent; border:1px solid transparent;
          color:var(--text-muted); cursor:pointer; transition:all 0.15s;
        }
        .period-btn:hover { color:var(--text-secondary); background:rgba(255,255,255,0.03); }
        .period-btn.active {
          color:var(--brand-orange); background:rgba(247,147,26,0.1);
          border-color:rgba(247,147,26,0.2);
        }
        .toggle-group { display:flex; align-items:center; gap:2px; margin-left:4px; }
        .toggle-label {
          font-family:var(--font-mono); font-size:9px; color:var(--text-muted);
          margin-right:4px; text-transform:uppercase; letter-spacing:0.05em;
        }
        .scale-btn {
          font-family:var(--font-mono); font-size:10px; font-weight:500;
          padding:4px 8px; border-radius:4px;
          background:transparent; border:1px solid transparent;
          color:var(--text-muted); cursor:pointer; transition:all 0.15s;
        }
        .scale-btn:hover { color:var(--text-secondary); }
        .scale-btn.active {
          color:var(--brand-orange); background:rgba(247,147,26,0.1);
          border-color:rgba(247,147,26,0.2);
        }

        .chart-body { display:flex; flex:1; position:relative; }
        .chart-area { flex:1; position:relative; min-height:520px; }
        .echarts-canvas { width:100%; }
        .chart-state {
          position:absolute; inset:0; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:10px;
          color:var(--text-muted); font-size:13px; z-index:2;
        }
        .spinner {
          width:20px; height:20px; border:2px solid var(--border-subtle);
          border-top-color:var(--brand-orange); border-radius:50%;
          animation:spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* Legenda lateral com labels posicionados ao lado da barra */
        .legend {
          width:42px; flex-shrink:0;
          padding:16px 4px 90px 0;
          display:flex; align-items:stretch;
        }
        .legend-track {
          position:relative; width:100%;
          display:flex; align-items:stretch;
        }
        .legend-bar {
          width:8px; flex-shrink:0; border-radius:4px;
          background:linear-gradient(
            to bottom,
            rgb(232,0,10) 0%,
            rgb(232,0,10) 10%,
            rgb(245,100,0) 30%,
            rgb(245,196,0) 50%,
            rgb(0,196,79) 75%,
            rgb(0,196,79) 100%
          );
        }
        .legend-val {
          position:absolute;
          left:14px;
          transform:translateY(-50%);
          font-family:var(--font-mono);
          font-size:9px;
          font-weight:500;
          white-space:nowrap;
          line-height:1;
        }

        .chart-footer {
          display:flex; align-items:center; gap:8px;
          padding:8px 20px; font-family:var(--font-mono);
          font-size:8px; color:#28283c;
        }
      `}</style>
    </div>
  );
}
