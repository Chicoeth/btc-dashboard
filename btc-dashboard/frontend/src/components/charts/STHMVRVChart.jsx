import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/* ─── constants ─── */
const PERIODS = [
  { label: '1A',  months: 12 },
  { label: '2A',  months: 24 },
  { label: '3A',  months: 36 },
  { label: '5A',  months: 60 },
  { label: 'Todo', months: null },
];
const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* ─── helpers ─── */
const fmtDate = ts => { const d = new Date(ts); return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`; };
const formatPrice = v => v >= 1000 ? (v/1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : v.toFixed(0);
const formatPriceFull = v => v >= 1000 ? '$' + v.toLocaleString('en-US', {maximumFractionDigits:0}) : '$' + v.toFixed(2);

/**
 * STH MVRV color scale:
 *   < 0.8  → green  (deep undervaluation for STH)
 *   0.8–1.0 → green→yellow
 *   1.0–2.0 → yellow→red
 *   > 2.0  → red    (STH euphoria)
 */
function sthMvrvColor(mvrv, alpha) {
  let r, g, b;
  if (mvrv <= 0.8) {
    r = 0; g = 196; b = 79;
  } else if (mvrv <= 1.0) {
    const t = (mvrv - 0.8) / 0.2;
    r = Math.round(t * 245); g = Math.round(196 + t * (196 - 196)); b = Math.round(79 * (1 - t));
  } else if (mvrv <= 2.0) {
    const t = (mvrv - 1.0) / 1.0;
    r = Math.round(245 + t * (232 - 245)); g = Math.round(196 * (1 - t)); b = Math.round(t * 10);
  } else {
    r = 232; g = 0; b = 10;
  }
  return alpha !== undefined ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

/* ─── build colored price segments (by STH MVRV value) ─── */
function buildColoredSegments(data, gridIndex, valueIndex) {
  if (!data.length) return [];
  const THRESHOLD = 0.04;
  const series = [];
  let segStart = 0;

  for (let i = 1; i <= data.length; i++) {
    const ended = i === data.length || Math.abs(data[i]?.[3] - data[i-1][3]) > THRESHOLD;
    if (ended) {
      const indices = [];
      for (let j = segStart; j < i; j++) indices.push(j);
      if (indices.length >= 2) {
        const avgMvrv = indices.reduce((s, j) => s + data[j][3], 0) / indices.length;
        const start = segStart > 0 ? segStart - 1 : segStart;
        series.push({
          type: 'line',
          xAxisIndex: gridIndex,
          yAxisIndex: gridIndex,
          data: Array.from({length: i - start}, (_, k) => [new Date(data[start + k][0]).toISOString().split('T')[0], data[start + k][valueIndex]]),
          smooth: false, symbol: 'none',
          lineStyle: { color: sthMvrvColor(avgMvrv), width: gridIndex === 0 ? 1.5 : 1.8, cap: 'round' },
          areaStyle: gridIndex === 1 ? { color: sthMvrvColor(avgMvrv, 0.07) } : undefined,
          silent: true, emphasis: { disabled: true },
          z: 3,
        });
      }
      segStart = i - 1;
    }
  }
  return series;
}

/* ─── STH MVRV area under curve (always visible) ─── */
function buildSthAreaSeries(data) {
  if (!data.length) return [];
  const THRESHOLD = 0.04;
  const series = [];
  let segStart = 0;

  for (let i = 1; i <= data.length; i++) {
    const ended = i === data.length || Math.abs(data[i]?.[3] - data[i-1][3]) > THRESHOLD;
    if (ended) {
      const start = segStart > 0 ? segStart - 1 : segStart;
      if (i - start >= 2) {
        const avgMvrv = Array.from({length: i - start}, (_, k) => data[start + k][3])
          .reduce((s, v) => s + v, 0) / (i - start);
        series.push({
          type: 'line',
          xAxisIndex: 1, yAxisIndex: 1,
          data: Array.from({length: i - start}, (_, k) => [
            new Date(data[start + k][0]).toISOString().split('T')[0],
            data[start + k][3],
          ]),
          smooth: false, symbol: 'none',
          lineStyle: { color: 'transparent', width: 0 },
          areaStyle: { color: sthMvrvColor(avgMvrv, 0.10) },
          silent: true, emphasis: { disabled: true },
          z: 2,
        });
      }
      segStart = i - 1;
    }
  }
  return series;
}

export default function STHMVRVChart({ sthMvrvData, loading, error }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const [isLog, setIsLog]               = useState(true);
  const [coloredPrice, setColoredPrice] = useState(true);
  const [coloredMvrv,  setColoredMvrv]  = useState(false);
  const [activePeriod, setActivePeriod] = useState('Todo');
  const [echartsReady, setEchartsReady] = useState(false);
  const [currentZoom, setCurrentZoom]   = useState({ start: 0, end: 100 });

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  const data = useMemo(() => {
    if (!Array.isArray(sthMvrvData) || !sthMvrvData.length) return [];
    return sthMvrvData.filter(d => Array.isArray(d) && d[0] && d[1] > 0 && d[2] > 0 && d[3] > 0);
  }, [sthMvrvData]);

  const zoomRange = useMemo(() => {
    if (!data.length) return { start: 0, end: 100 };
    const period = PERIODS.find(p => p.label === activePeriod);
    if (!period?.months) return { start: 0, end: 100 };
    const now    = Date.now();
    const fromTs = now - period.months * 30.44 * 86400000;
    const first  = data[0][0], last = data[data.length - 1][0];
    return { start: Math.max(0, ((fromTs - first) / (last - first)) * 100), end: 100 };
  }, [data, activePeriod]);

  const coloredPriceSeries = useMemo(
    () => coloredPrice ? buildColoredSegments(data, 0, 1) : [],
    [data, coloredPrice]
  );
  const sthAreaSeries  = useMemo(() => buildSthAreaSeries(data), [data]);
  const coloredMvrvLine = useMemo(
    () => coloredMvrv ? buildColoredSegments(data, 1, 3) : [],
    [data, coloredMvrv]
  );

  const buildOption = useCallback((zoom) => {
    if (!data.length) return null;
    const z = zoom || zoomRange;
    const timestamps = data.map(d => new Date(d[0]).toISOString().split('T')[0]);
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
      const prices = vis.flatMap(d => [d[1], d[2]]).filter(v => v > 0);
      if (prices.length) {
        yPriceBounds = {
          min: Math.pow(10, Math.log10(Math.min(...prices)) - 0.1),
          max: Math.pow(10, Math.log10(Math.max(...prices)) + 0.1),
        };
      }
    }

    const basePriceSeries = {
      type: 'line', name: '__price__',
      xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [new Date(d[0]).toISOString().split('T')[0], d[1]]),
      symbol: 'none', smooth: false,
      lineStyle: { color: coloredPrice ? 'transparent' : '#f7931a', width: coloredPrice ? 0 : 1.5 },
      areaStyle: coloredPrice ? undefined : {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(247,147,26,0.15)' }, { offset: 1, color: 'rgba(247,147,26,0)' }] }
      },
      z: 1,
    };

    const realizedSeries = {
      type: 'line', name: '__realized__',
      xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [new Date(d[0]).toISOString().split('T')[0], d[2]]),
      symbol: 'none', smooth: false,
      lineStyle: { color: '#7878c0', width: 1.2, type: 'dashed' },
      z: 2,
    };

    const baseMvrvSeries = {
      type: 'line', name: '__sthmvrv__',
      xAxisIndex: 1, yAxisIndex: 1,
      data: data.map(d => [new Date(d[0]).toISOString().split('T')[0], d[3]]),
      symbol: 'none', smooth: false,
      lineStyle: { color: 'transparent', width: 0 },
      z: 1,
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { type: 'dashed', width: 1, color: 'rgba(0,196,79,0.45)' },
        label: {
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          color: 'rgba(0,196,79,0.7)', position: 'insideStartTop',
        },
        data: [{ yAxis: 1.0, name: '1.0', label: { formatter: '1.0 · Custo médio STH', position: 'insideEndBottom' } }],
      },
    };

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: [
        { top: 16, left: 72, right: 24, bottom: '32%' },
        { top: '72%', left: 72, right: 24, bottom: 80 },
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          link: [{ xAxisIndex: 'all' }],
          lineStyle: { color: 'rgba(255,255,255,0.15)', width: 1, type: 'dashed' },
          label: { show: false },
        },
        backgroundColor: '#111120',
        borderColor: '#252540',
        borderWidth: 1,
        padding: [10, 14],
        formatter(params) {
          const p = params.find(p => p.seriesName === '__price__');
          const r = params.find(p => p.seriesName === '__realized__');
          const m = params.find(p => p.seriesName === '__sthmvrv__');
          if (!p) return '';
          const idx   = p.dataIndex;
          const row   = data[idx];
          const mvrv  = row?.[3];
          const color = sthMvrvColor(mvrv ?? 1);
          return `
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#9090b0;margin-bottom:6px">${fmtDate(row?.[0] ?? 0)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="width:6px;height:6px;border-radius:50%;background:#f7931a;flex-shrink:0"></span>
              <span style="font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;color:#e8e8f0">${formatPriceFull(p.value[1])}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="width:6px;height:2px;border-radius:1px;background:#7878c0;flex-shrink:0"></span>
              <span style="font-family:JetBrains Mono,monospace;font-size:11px;color:#7878c0">Realizado STH: ${formatPriceFull(r?.value?.[1] ?? 0)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0"></span>
              <span style="font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600;color:${color}">STH MVRV: ${mvrv?.toFixed(3) ?? '—'}</span>
            </div>`;
        },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      xAxis: [
        {
          type: 'category', data: timestamps, gridIndex: 0,
          axisLine: { lineStyle: { color: '#1e1e35' } },
          axisTick: { show: false },
          axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: xLabelFormatter, interval: xInterval },
          splitLine: { show: false },
        },
        {
          type: 'category', data: timestamps, gridIndex: 1,
          axisLine: { lineStyle: { color: '#1e1e35' } },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          type: isLog ? 'log' : 'value', logBase: 10,
          ...(isLog ? yPriceBounds : { scale: true }),
          gridIndex: 0,
          name: 'Preço BTC (USD)', nameLocation: 'middle', nameGap: 56,
          nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: formatPrice },
          splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        },
        {
          type: 'value', min: 0, max: 4,
          gridIndex: 1,
          name: 'STH MVRV', nameLocation: 'middle', nameGap: 56,
          nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: {
            color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            formatter: v => v.toFixed(1),
          },
          splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
          interval: 1,
        },
      ],
      dataZoom: [
        {
          type: 'slider', xAxisIndex: [0, 1], bottom: 10, height: 40,
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
        { type: 'inside', xAxisIndex: [0, 1], start: z.start, end: z.end },
      ],
      graphic: [{
        type: 'group',
        left: 80,
        top: 22,
        children: [
          {
            type: 'rect',
            shape: { width: 270, height: 20, r: 4 },
            style: { fill: 'rgba(10,10,20,0.72)', stroke: 'rgba(120,120,192,0.3)', lineWidth: 1 },
          },
          {
            type: 'line',
            shape: { x1: 10, y1: 10, x2: 30, y2: 10 },
            style: { stroke: '#7878c0', lineWidth: 1.5, lineDash: [4, 3] },
          },
          {
            type: 'text',
            left: 36,
            top: 3,
            style: {
              text: 'Linha tracejada = Preço Realizado STH',
              fill: '#9090c8',
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
            },
          },
        ],
      }],
      series: [
        basePriceSeries,
        realizedSeries,
        baseMvrvSeries,
        ...sthAreaSeries,
        ...(!coloredMvrv ? [{
          type: 'line', name: '__sthmvrv_gray__',
          xAxisIndex: 1, yAxisIndex: 1,
          data: data.map(d => [new Date(d[0]).toISOString().split('T')[0], d[3]]),
          symbol: 'none', smooth: false,
          lineStyle: { color: '#9090b0', width: 1.5 },
          emphasis: { disabled: true }, silent: true,
          z: 5,
        }] : []),
        ...(coloredPrice ? coloredPriceSeries : []),
        ...coloredMvrvLine,
      ],
    };
  }, [data, isLog, coloredPrice, coloredMvrv, zoomRange, coloredPriceSeries, sthAreaSeries, coloredMvrvLine]);

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
  }, [isLog, coloredPrice, coloredMvrv, zoomRange, currentZoom, buildOption]);

  const latest      = data[data.length - 1];
  const latestColor = latest ? sthMvrvColor(latest[3]) : '#9090b0';

  return (
    <div className="sth-mvrv-chart-wrapper">
      <div className="chart-header">
        <div className="chart-left">
          {latest && (
            <>
              <span className="price-display">{formatPriceFull(latest[1])}</span>
              <span className="mvrv-badge" style={{
                color: latestColor,
                background: sthMvrvColor(latest[3], 0.12),
                borderColor: sthMvrvColor(latest[3], 0.3),
              }}>
                STH MVRV {latest[3].toFixed(3)}
              </span>
              <span className="realized-label">
                Preço Realizado STH: <strong>{formatPriceFull(latest[2])}</strong>
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
          <div className="toggle-group" title="Cor do gráfico STH MVRV">
            <span className="toggle-label">MVRV</span>
            <button className={`scale-btn ${coloredMvrv ? 'active' : ''}`}  onClick={() => setColoredMvrv(true)}>COR</button>
            <button className={`scale-btn ${!coloredMvrv ? 'active' : ''}`} onClick={() => setColoredMvrv(false)}>SEM COR</button>
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
                <span>Sem dados. Execute <code>node scripts/fetch-sth-mvrv.mjs</code></span>
              )}
            </div>
          )}
          <div ref={chartRef} className="echarts-canvas"
            style={{ opacity: loading || error || !data.length ? 0 : 1, height: '520px' }} />
        </div>

        {/* Legenda lateral */}
        <div className="legend-bar-wrap">
          <div className="legend-bar">
            <div className="bar-gradient" />
            <span className="bar-label" style={{ top: '0%' }}>3.0</span>
            <span className="bar-label" style={{ top: '33%' }}>2.0</span>
            <span className="bar-label" style={{ top: '60%' }}>1.0</span>
            <span className="bar-label" style={{ top: '73%' }}>0.8</span>
            <span className="bar-label" style={{ top: '100%' }}>0.0</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .sth-mvrv-chart-wrapper {
          display: flex; flex-direction: column;
        }
        .chart-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px 8px; flex-wrap: wrap; gap: 8px;
        }
        .chart-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .price-display {
          font-family: var(--font-display); font-size: 20px; font-weight: 700;
          color: var(--text-primary);
        }
        .mvrv-badge {
          font-family: var(--font-mono); font-size: 11px; font-weight: 600;
          padding: 3px 8px; border-radius: 4px; border: 1px solid;
        }
        .realized-label {
          font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);
        }
        .realized-label strong { color: #7878c0; }
        .chart-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .period-selector { display: flex; gap: 2px; }
        .period-btn {
          font-family: var(--font-mono); font-size: 10px; font-weight: 500;
          padding: 3px 8px; border-radius: 3px; border: none; cursor: pointer;
          background: transparent; color: var(--text-muted); transition: all 0.15s;
        }
        .period-btn:hover { color: var(--text-secondary); background: rgba(255,255,255,0.04); }
        .period-btn.active { color: var(--brand-orange); background: rgba(247,147,26,0.1); }
        .toggle-group { display: flex; align-items: center; gap: 2px; }
        .toggle-label {
          font-family: var(--font-mono); font-size: 9px; color: var(--text-muted);
          margin-right: 2px; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .scale-btn {
          font-family: var(--font-mono); font-size: 10px;
          padding: 3px 7px; border-radius: 3px; border: none; cursor: pointer;
          background: transparent; color: var(--text-muted); transition: all 0.15s;
        }
        .scale-btn:hover { color: var(--text-secondary); }
        .scale-btn.active { color: var(--brand-orange); background: rgba(247,147,26,0.1); }
        .chart-body { display: flex; position: relative; }
        .chart-area { flex: 1; min-width: 0; position: relative; }
        .chart-state {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px;
          font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); z-index: 2;
        }
        .spinner {
          width: 24px; height: 24px; border: 2px solid var(--border-subtle);
          border-top-color: var(--brand-orange); border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .echarts-canvas { width: 100%; }
        .legend-bar-wrap {
          width: 40px; flex-shrink: 0; display: flex; align-items: center;
          justify-content: center; padding: 16px 0 80px;
        }
        .legend-bar {
          position: relative; width: 10px; height: 180px;
        }
        .bar-gradient {
          width: 10px; height: 100%; border-radius: 5px;
          background: linear-gradient(
            to bottom,
            rgb(232,0,10) 0%,
            rgb(232,0,10) 10%,
            rgb(245,196,0) 50%,
            rgb(0,196,79) 73%,
            rgb(0,196,79) 100%
          );
        }
        .bar-label {
          position: absolute; left: 16px; transform: translateY(-50%);
          font-family: var(--font-mono); font-size: 9px; color: var(--text-muted);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
