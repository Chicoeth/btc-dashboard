/**
 * components/charts/FearGreedChart.jsx
 * Gráfico duplo: preço BTC colorido por F&G (topo) + linha F&G (baixo)
 * Dados preço: [[ts_ms, close, high], ...]
 * Dados F&G:   [[ts_ms, value, classification], ...]
 */

import { useEffect, useRef, useMemo, useState } from 'react';

// Converte valor 0–100 em cor RGB viva
function fngColor(value, alpha = 1) {
  // 0=vermelho puro, 50=amarelo, 100=verde vivo
  const v = Math.max(0, Math.min(100, value));
  let r, g, b;
  if (v <= 50) {
    // vermelho (#e8000a) → amarelo (#f5c400)
    const t = v / 50;
    r = Math.round(232 + (245 - 232) * t);
    g = Math.round(0   + (196 - 0)   * t);
    b = Math.round(10  + (0   - 10)  * t);
  } else {
    // amarelo (#f5c400) → verde (#00c44f)
    const t = (v - 50) / 50;
    r = Math.round(245 + (0   - 245) * t);
    g = Math.round(196 + (196 - 196) * t);
    b = Math.round(0   + (79  - 0)   * t);
  }
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function formatPriceFull(v) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatPrice(v) {
  if (v >= 1000000) return '$' + (v/1000000).toFixed(2)+'M';
  if (v >= 1000)    return '$' + (v/1000).toFixed(0)+'k';
  return '$' + v.toFixed(0);
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}

const MONTHS_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

const PERIODS = [
  { label: '1A', months: 12 },
  { label: '2A', months: 24 },
  { label: '3A', months: 36 },
  { label: '5A', months: 60 },
  { label: 'Todo', months: null },
];

// Gradient legend steps
const LEGEND_STEPS = [100,90,80,70,60,50,40,30,20,10,0];

export default function FearGreedChart({ priceData, fngData, loading, error }) {
  const chartRef    = useRef(null);
  const chartInst   = useRef(null);
  const [isLog, setIsLog]               = useState(true);
  const [colored, setColored]           = useState(true);
  const [activePeriod, setActivePeriod] = useState('Todo');
  const [echartsReady, setEchartsReady] = useState(false);

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  // Merge price + fng by date
  const merged = useMemo(() => {
    if (!priceData?.length || !fngData?.length) return [];
    const fngMap = new Map();
    for (const [ts, val, cls] of fngData)
      fngMap.set(new Date(ts).toISOString().split('T')[0], { val, cls });

    return priceData
      .map(([ts, close]) => {
        const date = new Date(ts).toISOString().split('T')[0];
        const fng  = fngMap.get(date);
        return fng ? { ts, date, close, fng: fng.val, cls: fng.cls } : null;
      })
      .filter(Boolean);
  }, [priceData, fngData]);

  // Zoom range
  const zoomRange = useMemo(() => {
    if (!merged.length) return { start: 0, end: 100 };
    const period = PERIODS.find(p => p.label === activePeriod);
    if (!period?.months) return { start: 0, end: 100 };
    const now      = Date.now();
    const fromTs   = now - period.months * 30.44 * 24 * 60 * 60 * 1000;
    const firstTs  = merged[0].ts;
    const lastTs   = merged[merged.length-1].ts;
    const startPct = Math.max(0, ((fromTs - firstTs) / (lastTs - firstTs)) * 100);
    return { start: startPct, end: 100 };
  }, [merged, activePeriod]);

  const chartOption = useMemo(() => {
    if (!merged.length) return null;

    const dates  = merged.map(d => d.date);
    const closes = merged.map(d => d.close);
    const fngVals = merged.map(d => d.fng);

    const spanDays = Math.round(((zoomRange.end - zoomRange.start) / 100) * dates.length);

    const xLabelFormatter = (val) => {
      const d = new Date(val), m = d.getMonth(), y = d.getFullYear(), day = d.getDate();
      if (spanDays > 365*3) return m === 0 ? String(y) : '';
      if (spanDays > 180)   { if (m===0) return String(y); if (m%3===0) return MONTHS_PT[m]; return ''; }
      if (spanDays > 60)    return m === 0 ? String(y) : MONTHS_PT[m];
      if (day===1) return MONTHS_PT[m]+(m===0 ? '\n'+y : '');
      return [8,15,22].includes(day) ? String(day) : '';
    };
    const xInterval = spanDays > 365*3 ? Math.floor(dates.length/16)
                    : spanDays > 180   ? Math.floor(spanDays/6)
                    : spanDays > 60    ? Math.floor(spanDays/7)
                    : 'auto';

    // Build colored price series: each segment gets its color
    // Use piecewise color via itemStyle per-point on scatter/custom, or
    // use multiple line segments. Simplest: use markArea colored bands isn't practical.
    // Best approach: series of individual colored points + connecting lines using
    // a single series with lineStyle color function — ECharts doesn't support per-point
    // line color natively, so we use a custom series of polyline segments.
    // Practical solution: build N series of length 2 each is too slow.
    // Best practical: use one series with visualMap on the fng value array.

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: [
        { top: 16, left: 68, right: 24, bottom: '44%' },    // price
        { top: '62%', left: 68, right: 24, bottom: 80 },    // fng line
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'rgba(255,255,255,0.12)', width: 1, type: 'dashed' },
          label: { show: false },
        },
        backgroundColor: '#111120',
        borderColor: '#252540',
        borderWidth: 1,
        padding: [10, 14],
        formatter(params) {
          const price = params.find(p => p.seriesIndex === 0);
          const fng   = params.find(p => p.seriesIndex === 1);
          if (!price) return '';
          const fngVal = fng?.value ?? fngVals[price.dataIndex];
          const color  = fngColor(fngVal);
          const row    = merged[price.dataIndex];
          return `
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#9090b0;margin-bottom:5px">${fmtDate(new Date(price.axisValue).getTime())}</div>
            <div style="font-size:16px;font-weight:700;color:#e8e8f0;margin-bottom:6px">${formatPriceFull(price.value)}</div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
              <span style="font-family:JetBrains Mono,monospace;font-size:12px;color:${color};font-weight:600">${fngVal} — ${row?.cls ?? ''}</span>
            </div>
          `;
        },
      },

      // VisualMap drives color of the price series
      visualMap: colored ? [{
        show: false,
        seriesIndex: 0,
        dimension: 1,   // map the y-value's companion (we'll use a trick)
        min: 0,
        max: 100,
        inRange: {
          color: [
            '#e8000a', // 0
            '#e8000a',
            '#f5c400', // 50
            '#00c44f', // 100
          ],
        },
      }] : [],

      xAxis: [
        {
          type: 'category', data: dates, gridIndex: 0,
          axisLine: { lineStyle: { color: '#1e1e35' } },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
          boundaryGap: false,
        },
        {
          type: 'category', data: dates, gridIndex: 1,
          axisLine: { lineStyle: { color: '#1e1e35' } },
          axisTick: { show: false },
          axisLabel: {
            color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            margin: 10, interval: xInterval, formatter: xLabelFormatter,
            showMinLabel: true, showMaxLabel: false,
          },
          splitLine: { show: false },
          boundaryGap: false,
        },
      ],
      yAxis: [
        {
          type: isLog ? 'log' : 'value', logBase: 10, scale: true,
          gridIndex: 0,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: formatPrice },
          splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        },
        {
          type: 'value', min: 0, max: 100,
          gridIndex: 1,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
          splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        },
      ],

      dataZoom: [
        {
          type: 'slider', xAxisIndex: [0, 1], bottom: 10, height: 40,
          start: zoomRange.start, end: zoomRange.end,
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
          labelFormatter(val, str) { return str ? str.substring(0,7) : ''; },
        },
        { type: 'inside', xAxisIndex: [0,1], start: zoomRange.start, end: zoomRange.end },
      ],

      series: [
        {
          // Price series — colored by F&G via visualMap
          // Trick: use a 2D dataset where dim0=close, dim1=fngVal so visualMap maps on dim1
          type: 'line',
          xAxisIndex: 0, yAxisIndex: 0,
          data: merged.map(d => ({ value: [d.date, d.close, d.fng] })),
          encode: { x: 0, y: 1 },
          smooth: false, symbol: 'none',
          lineStyle: { width: 1.5 },
          areaStyle: colored ? undefined : {
            color: { type:'linear', x:0,y:0,x2:0,y2:1,
              colorStops:[{offset:0,color:'rgba(247,147,26,0.15)'},{offset:1,color:'rgba(247,147,26,0)'}] }
          },
          // When not colored, use orange
          ...(colored ? {} : { lineStyle: { color: '#f7931a', width: 1.5 } }),
        },
        {
          // F&G line
          type: 'line',
          xAxisIndex: 1, yAxisIndex: 1,
          data: fngVals,
          smooth: true, symbol: 'none',
          lineStyle: { width: 1.5, color: '#9090b0' },
          areaStyle: {
            color: { type:'linear', x:0,y:0,x2:0,y2:1,
              colorStops:[{offset:0,color:'rgba(144,144,176,0.12)'},{offset:1,color:'rgba(144,144,176,0)'}] }
          },
        },
      ],
    };
  }, [merged, isLog, colored, zoomRange]);

  // When colored, we need to paint each segment manually since ECharts visualMap
  // on line series uses the y-value, not a separate dimension.
  // Better approach: use custom rendering with canvas after chart renders.
  // Actually the cleanest ECharts approach: use a dataset + visualMap on dimension 2.
  // Let's fix the visualMap to use dimension 2 (the fng value).
  const finalOption = useMemo(() => {
    if (!chartOption) return null;
    if (!colored) return chartOption;
    // Fix visualMap to map on the fng dimension (index 2 of the value array)
    return {
      ...chartOption,
      visualMap: [{
        show: false,
        seriesIndex: 0,
        dimension: 2,
        min: 0,
        max: 100,
        inRange: {
          color: ['#e8000a','#e8000a','#f5c400','#00c44f'],
          colorLightness: [0, 0, 0, 0],
        },
      }],
    };
  }, [chartOption, colored]);

  useEffect(() => {
    if (!echartsReady || !chartRef.current || !finalOption) return;
    const init = async () => {
      const echarts = await import('echarts');
      let chart = chartInst.current;
      if (!chart) {
        chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        chartInst.current = chart;
        new ResizeObserver(() => chart.resize()).observe(chartRef.current);
      }
      chart.setOption(finalOption, { notMerge: true });
    };
    init();
  }, [echartsReady, finalOption]);

  // Latest stats
  const latest = merged[merged.length - 1];
  const latestColor = latest ? fngColor(latest.fng) : '#9090b0';

  return (
    <div className="fng-chart-wrapper">
      {/* Header */}
      <div className="chart-header">
        <div className="chart-left">
          {latest && (
            <>
              <span className="price-display">{formatPriceFull(latest.close)}</span>
              <span className="fng-badge" style={{ color: latestColor, background: fngColor(latest.fng, 0.12), borderColor: fngColor(latest.fng, 0.3) }}>
                {latest.fng} · {latest.cls}
              </span>
            </>
          )}
        </div>
        <div className="chart-controls">
          <div className="period-selector">
            {PERIODS.map(p => (
              <button key={p.label} className={`period-btn ${activePeriod===p.label?'active':''}`}
                onClick={() => setActivePeriod(p.label)}>{p.label}</button>
            ))}
          </div>
          <div className="toggle-group">
            <button className={`scale-btn ${isLog?'active':''}`}    onClick={() => setIsLog(true)}>LOG</button>
            <button className={`scale-btn ${!isLog?'active':''}`}   onClick={() => setIsLog(false)}>LINEAR</button>
          </div>
          <div className="toggle-group">
            <button className={`scale-btn ${colored?'active':''}`}  onClick={() => setColored(true)}>COR</button>
            <button className={`scale-btn ${!colored?'active':''}`} onClick={() => setColored(false)}>SEM COR</button>
          </div>
        </div>
      </div>

      {/* Chart + Legend */}
      <div className="chart-body">
        <div className="chart-area">
          {(loading || error || !merged.length) && (
            <div className="chart-state">
              {loading && <><div className="spinner"/><span>Carregando...</span></>}
              {error   && <span style={{color:'#ef4444'}}>⚠ {error}</span>}
              {!loading && !error && !merged.length && <span>Sem dados. Execute <code>node scripts/fetch-fng.mjs</code></span>}
            </div>
          )}
          <div ref={chartRef} className="echarts-canvas" style={{ opacity: loading||error||!merged.length ? 0 : 1 }} />
        </div>

        {/* Color scale legend */}
        <div className="legend">
          <div className="legend-bar" />
          <div className="legend-labels">
            {LEGEND_STEPS.map(v => (
              <div key={v} className="legend-label" style={{ color: fngColor(v) }}>{v}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      {merged.length > 0 && (
        <div className="chart-footer">
          <span>{merged.length.toLocaleString('pt-BR')} dias de dados</span>
          <span>·</span>
          <span>{new Date(merged[0].ts).toLocaleDateString('pt-BR',{month:'short',year:'numeric'})} → {new Date(merged[merged.length-1].ts).toLocaleDateString('pt-BR',{month:'short',year:'numeric'})}</span>
          <span>·</span>
          <span>Fonte: alternative.me / Yahoo Finance</span>
        </div>
      )}

      <style jsx>{`
        .fng-chart-wrapper { display:flex; flex-direction:column; height:100%; }

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
        .fng-badge {
          font-family:var(--font-mono); font-size:12px; font-weight:600;
          padding:3px 10px; border-radius:20px; border:1px solid;
          letter-spacing:0.03em;
        }

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
        .period-btn:hover, .scale-btn:hover { color:var(--text-primary); background:rgba(255,255,255,0.04); }
        .period-btn.active, .scale-btn.active { color:var(--brand-orange); background:rgba(247,147,26,0.1); }

        .chart-body { flex:1; display:flex; min-height:0; }
        .chart-area { flex:1; position:relative; min-height:500px; }
        .echarts-canvas { width:100%; height:100%; min-height:500px; transition:opacity 0.3s; }

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

        /* Vertical color scale legend */
        .legend {
          display:flex; flex-direction:row; align-items:stretch;
          padding:16px 12px 80px 8px; gap:4px;
        }
        .legend-bar {
          width:10px; border-radius:5px; flex-shrink:0;
          background:linear-gradient(to bottom,
            #00c44f 0%,
            #f5c400 50%,
            #e8000a 100%
          );
        }
        .legend-labels {
          display:flex; flex-direction:column; justify-content:space-between;
        }
        .legend-label {
          font-family:var(--font-mono); font-size:9px; font-weight:500;
          line-height:1; letter-spacing:0.03em;
        }

        .chart-footer {
          display:flex; align-items:center; gap:8px; padding:8px 20px;
          border-top:1px solid var(--border-subtle); font-family:var(--font-mono);
          font-size:10px; color:var(--text-muted); flex-wrap:wrap;
        }
      `}</style>
    </div>
  );
}
