/**
 * MVRVChart.jsx
 * Gráfico duplo: preço BTC + preço realizado (topo) | MVRV linear colorido (baixo)
 * Dados: [[ts_ms, btc_price, realized_price, mvrv], ...]
 *
 * Escala de cor MVRV:
 *   ≤ 1.0  → verde  (#00c44f)
 *   1.0–2.5 → gradiente verde→vermelho
 *   ≥ 2.5  → vermelho saturado (#e8000a)
 */

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';

// Escala de cor: verde abaixo de 1, vermelho acima de 2.5
const COLOR_MIN = 1.0;
const COLOR_MAX = 3.0;

function mvrvColor(value, alpha = 1) {
  const t = Math.max(0, Math.min(1, (value - COLOR_MIN) / (COLOR_MAX - COLOR_MIN)));
  let r, g, b;
  if (t <= 0.5) {
    const s = t / 0.5;
    // verde → amarelo
    r = Math.round(0   + (245 - 0)   * s);
    g = Math.round(196 + (196 - 196) * s);
    b = Math.round(79  + (0   - 79)  * s);
  } else {
    const s = (t - 0.5) / 0.5;
    // amarelo → vermelho
    r = Math.round(245 + (232 - 245) * s);
    g = Math.round(196 + (0   - 196) * s);
    b = 0;
  }
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function formatPriceFull(v) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatPrice(v) {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000)     return '$' + (v / 1_000).toFixed(0) + 'k';
  return '$' + v.toFixed(0);
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MONTHS_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const PERIODS = [
  { label: '1A', months: 12 },
  { label: '2A', months: 24 },
  { label: '3A', months: 36 },
  { label: '5A', months: 60 },
  { label: 'Todo', months: null },
];

// Legenda lateral: de vermelho (2.5+) até verde (<1)
const LEGEND_VALUES = [4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5, 0.0];

// Quebra série de preço em segmentos coloridos por MVRV
function buildColoredSegments(data, gridIndex, valueIndex) {
  // Usa índice numérico como X para casar exatamente com o xAxis category
  if (!data.length) return [];
  const THRESHOLD = 0.06;
  const series = [];
  let segStart = 0;

  for (let i = 1; i <= data.length; i++) {
    const ended = i === data.length || Math.abs(data[i]?.[3] - data[i-1][3]) > THRESHOLD;
    if (ended) {
      const indices = [];
      for (let j = segStart; j < i; j++) indices.push(j);
      if (indices.length >= 2) {
        const avgMvrv = indices.reduce((s, j) => s + data[j][3], 0) / indices.length;
        // Conecta com o ponto anterior para não ter gaps
        const start = segStart > 0 ? segStart - 1 : segStart;
        series.push({
          type: 'line',
          xAxisIndex: gridIndex,
          yAxisIndex: gridIndex,
          // Usa índice numérico — mapeia direto ao array do xAxis category
          data: Array.from({length: i - start}, (_, k) => [new Date(data[start + k][0]).toISOString().split('T')[0], data[start + k][valueIndex]]),
          smooth: false, symbol: 'none',
          lineStyle: { color: mvrvColor(avgMvrv), width: gridIndex === 0 ? 1.5 : 1.8, cap: 'round' },
          areaStyle: gridIndex === 1 ? { color: mvrvColor(avgMvrv, 0.07) } : undefined,
          silent: true, emphasis: { disabled: true },
          z: 3,
        });
      }
      segStart = i - 1;
    }
  }
  return series;

// Série de área colorida do MVRV — sempre visível (independe do toggle COR)
// Linha transparente, apenas preenchimento sutil colorido
function buildMvrvAreaSeries(data) {
  if (!data.length) return [];
  const THRESHOLD = 0.06;
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
          areaStyle: { color: mvrvColor(avgMvrv, 0.10) },
          silent: true, emphasis: { disabled: true },
          z: 2,
        });
      }
      segStart = i - 1;
    }
  }
  return series;
}

export default function MVRVChart({ mvrvData, loading, error }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const [isLog, setIsLog]               = useState(true);
  const [colored, setColored]           = useState(false);
  const [activePeriod, setActivePeriod] = useState('Todo');
  const [echartsReady, setEchartsReady] = useState(false);
  const [currentZoom, setCurrentZoom]   = useState({ start: 0, end: 100 });

  useEffect(() => { import('echarts').then(() => setEchartsReady(true)); }, []);

  const data = useMemo(() => {
    if (!Array.isArray(mvrvData) || !mvrvData.length) return [];
    return mvrvData.filter(d => Array.isArray(d) && d[0] && d[1] > 0 && d[2] > 0 && d[3] > 0);
  }, [mvrvData]);

  const zoomRange = useMemo(() => {
    if (!data.length) return { start: 0, end: 100 };
    const period = PERIODS.find(p => p.label === activePeriod);
    if (!period?.months) return { start: 0, end: 100 };
    const now    = Date.now();
    const fromTs = now - period.months * 30.44 * 86400000;
    const first  = data[0][0], last = data[data.length - 1][0];
    return { start: Math.max(0, ((fromTs - first) / (last - first)) * 100), end: 100 };
  }, [data, activePeriod]);

  // Séries coloridas — só recalcula quando dados ou colored mudam
  const coloredPriceSeries = useMemo(
    () => colored ? buildColoredSegments(data, 0, 1) : [],
    [data, colored]
  );
  // MVRV: sempre com área colorida, linha colorida só quando colored=true
  const mvrvAreaSeries  = useMemo(() => buildMvrvAreaSeries(data), [data]);
  const coloredMvrvLine = useMemo(
    () => colored ? buildColoredSegments(data, 1, 3) : [],
    [data, colored]
  );

  const buildOption = useCallback((zoom) => {
    if (!data.length) return null;
    const z = zoom || zoomRange;
    const timestamps = data.map(d => new Date(d[0]).toISOString().split('T')[0]);
    const spanDays   = Math.round(((z.end - z.start) / 100) * data.length);

    // Labels X adaptativos
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

    // Bounds log do eixo de preço baseados em dados visíveis
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

    // Série base preço — invisível, só para tooltip
    const basePriceSeries = {
      type: 'line', name: '__price__',
      xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [new Date(d[0]).toISOString().split('T')[0], d[1]]),
      symbol: 'none', smooth: false,
      lineStyle: { color: colored ? 'transparent' : '#f7931a', width: colored ? 0 : 1.5 },
      areaStyle: colored ? undefined : {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(247,147,26,0.15)' }, { offset: 1, color: 'rgba(247,147,26,0)' }] }
      },
      z: 1,
    };

    // Preço realizado — linha tracejada roxa
    const realizedSeries = {
      type: 'line', name: '__realized__',
      xAxisIndex: 0, yAxisIndex: 0,
      data: data.map(d => [new Date(d[0]).toISOString().split('T')[0], d[2]]),
      symbol: 'none', smooth: false,
      lineStyle: { color: '#7878c0', width: 1.2, type: 'dashed' },
      z: 2,
    };

    // Série base MVRV — invisível, só para tooltip + markLine
    const baseMvrvSeries = {
      type: 'line', name: '__mvrv__',
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
        data: [{ yAxis: 1.0, name: '1.0', label: { formatter: '1.0 · Fundo histórico', position: 'insideEndBottom' } }],
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
          const m = params.find(p => p.seriesName === '__mvrv__');
          if (!p) return '';
          const idx   = p.dataIndex;
          const row   = data[idx];
          const mvrv  = row?.[3];
          const color = mvrvColor(mvrv ?? 1);
          return `
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#9090b0;margin-bottom:6px">${fmtDate(row?.[0] ?? 0)}</div>
            <div style="display:flex;flex-direction:column;gap:4px">
              <div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#9090b0;font-family:JetBrains Mono,monospace;font-size:11px">Preço do BTC</span>
                <span style="color:#e8e8f0;font-family:JetBrains Mono,monospace;font-size:12px;font-weight:600">${formatPriceFull(row?.[1] ?? 0)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#9090b0;font-family:JetBrains Mono,monospace;font-size:11px">Preço Realizado</span>
                <span style="color:#7878c0;font-family:JetBrains Mono,monospace;font-size:12px">${formatPriceFull(row?.[2] ?? 0)}</span>
              </div>
              <div style="margin-top:2px;padding-top:6px;border-top:1px solid #252540;display:flex;justify-content:space-between;gap:16px">
                <span style="color:#9090b0;font-family:JetBrains Mono,monospace;font-size:11px">MVRV</span>
                <span style="color:${color};font-family:JetBrains Mono,monospace;font-size:16px;font-weight:700">${mvrv?.toFixed(3) ?? '—'}</span>
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
          name: 'Preço BTC (USD)', nameLocation: 'middle', nameGap: 56,
          nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, formatter: formatPrice },
          splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
        },
        {
          type: 'value', min: 0, max: 4,
          gridIndex: 1,
          name: 'MVRV', nameLocation: 'middle', nameGap: 56,
          nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: {
            color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            formatter: v => v.toFixed(1),
          },
          splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
          interval: 0.5,
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
      series: [
        basePriceSeries,
        realizedSeries,
        baseMvrvSeries,
        ...mvrvAreaSeries,
        ...(colored ? coloredPriceSeries : []),
        ...coloredMvrvLine,
      ],
    };
  }, [data, isLog, colored, zoomRange, coloredPriceSeries, mvrvAreaSeries, coloredMvrvLine]);

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

  useEffect(() => {
    const chart = chartInst.current;
    if (!chart || !data.length) return;
    const option = buildOption(currentZoom);
    if (option) chart.setOption(option, { notMerge: false, replaceMerge: ['series'] });
  }, [isLog, colored, zoomRange, currentZoom, buildOption]);

  const latest      = data[data.length - 1];
  const latestColor = latest ? mvrvColor(latest[3]) : '#9090b0';

  return (
    <div className="mvrv-chart-wrapper">
      <div className="chart-header">
        <div className="chart-left">
          {latest && (
            <>
              <span className="price-display">{formatPriceFull(latest[1])}</span>
              <span className="mvrv-badge" style={{
                color: latestColor,
                background: mvrvColor(latest[3], 0.12),
                borderColor: mvrvColor(latest[3], 0.3),
              }}>
                MVRV {latest[3].toFixed(3)}
              </span>
              <span className="realized-label">
                Preço Realizado: <strong>{formatPriceFull(latest[2])}</strong>
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
          <div className="toggle-group">
            <button className={`scale-btn ${colored ? 'active' : ''}`}  onClick={() => setColored(true)}>COR</button>
            <button className={`scale-btn ${!colored ? 'active' : ''}`} onClick={() => setColored(false)}>SEM COR</button>
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
                <span>Sem dados. Execute <code>node scripts/fetch-mvrv.mjs</code></span>
              )}
            </div>
          )}
          <div ref={chartRef} className="echarts-canvas"
            style={{ opacity: loading || error || !data.length ? 0 : 1 }} />
        </div>
        <div className="legend">
          <div className="legend-bar" />
          <div className="legend-labels">
            {LEGEND_VALUES.map(v => (
              <div key={v} className="legend-label" style={{ color: mvrvColor(v) }}>
                {v.toFixed(1)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.length > 0 && (
        <div className="chart-footer">
          <span>{data.length.toLocaleString('pt-BR')} dias de dados</span>
          <span>·</span>
          <span>
            {new Date(data[0][0]).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            {' → '}
            {new Date(data[data.length - 1][0]).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
          </span>
          <span>·</span>
          <span>Fonte: CoinMetrics</span>
        </div>
      )}

      <div className="zone-legend">
        <div className="zone-item realized-highlight">
          <span className="zone-line" />
          <span>Linha tracejada = Preço Realizado do BTC</span>
        </div>
      </div>

      <style jsx>{`
        .mvrv-chart-wrapper { display:flex; flex-direction:column; height:100%; }
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
        .mvrv-badge {
          font-family:var(--font-mono); font-size:12px; font-weight:600;
          padding:3px 10px; border-radius:20px; border:1px solid; letter-spacing:0.03em;
        }
        .realized-label {
          font-family:var(--font-mono); font-size:11px; color:#7878c0;
        }
        .realized-label strong { color:#9090c8; font-weight:600; }
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
        .chart-area { flex:1; position:relative; min-height:520px; }
        .echarts-canvas { width:100%; height:100%; min-height:520px; transition:opacity 0.3s; }
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
        .legend {
          display:flex; flex-direction:row; align-items:stretch;
          padding:16px 12px 80px 8px; gap:4px;
        }
        .legend-bar {
          width:10px; border-radius:5px; flex-shrink:0;
          background:linear-gradient(to bottom, #e8000a 0%, #f5c400 50%, #00c44f 100%);
        }
        .legend-labels { display:flex; flex-direction:column; justify-content:space-between; }
        .legend-label { font-family:var(--font-mono); font-size:9px; font-weight:500; line-height:1; }
        .chart-footer {
          display:flex; align-items:center; gap:8px; padding:8px 20px;
          border-top:1px solid var(--border-subtle); font-family:var(--font-mono);
          font-size:10px; color:var(--text-muted); flex-wrap:wrap;
        }
        .zone-legend {
          display:flex; align-items:center; gap:16px; padding:6px 20px 12px;
          flex-wrap:wrap;
        }
        .zone-item {
          display:flex; align-items:center; gap:6px;
          font-family:var(--font-mono); font-size:10px; color:#9090b0;
        }
        .zone-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .zone-line { width:18px; height:0; border-top:2px dashed #7878c0; flex-shrink:0; }
        .realized-highlight {
          background: rgba(120,120,192,0.08);
          border: 1px solid rgba(120,120,192,0.25);
          border-radius: 6px;
          padding: 5px 12px;
          font-size: 11px !important;
          color: #9090c8 !important;
          font-weight: 500;
        }
        .realized-highlight span:last-child { color: #9090c8; }
      `}</style>
    </div>
  );
}
