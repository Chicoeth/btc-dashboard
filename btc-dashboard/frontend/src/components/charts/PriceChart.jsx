/**
 * components/charts/PriceChart.jsx
 * Formato de dados: [[timestamp_ms, close, high], ...]
 */

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useTheme } from '../ThemeContext';
import { patchOption } from '../chartThemeHelper';

const HALVINGS = [
  { date: '2012-11-28', label: '1º Halving', reward: '25 BTC' },
  { date: '2016-07-09', label: '2º Halving', reward: '12.5 BTC' },
  { date: '2020-05-11', label: '3º Halving', reward: '6.25 BTC' },
  { date: '2024-04-19', label: '4º Halving', reward: '3.125 BTC' },
];

const PERIODS = [
  { label: '1A',   months: 12 },
  { label: '2A',   months: 24 },
  { label: '3A',   months: 36 },
  { label: '5A',   months: 60 },
  { label: 'Todo', months: null },
];

const MONTHS_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function formatPrice(value) {
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(2) + 'M';
  if (value >= 1000)    return '$' + (value / 1000).toFixed(0) + 'k';
  return '$' + value.toFixed(0);
}

function formatPriceFull(value) {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTooltip(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function PriceChart({ data, loading, error }) {
  const chartRef    = useRef(null);
  const chartInst   = useRef(null);
  const { isDark } = useTheme();
  const [isLog, setIsLog]               = useState(true);
  const [activePeriod, setActivePeriod] = useState('Todo');
  const [echartsReady, setEchartsReady] = useState(false);
  const [currentZoom, setCurrentZoom]   = useState({ start: 0, end: 100 });

  useEffect(() => {
    import('echarts').then(() => setEchartsReady(true));
  }, []);

  const zoomRange = useMemo(() => {
    if (!data || data.length === 0) return { start: 0, end: 100 };
    const period = PERIODS.find(p => p.label === activePeriod);
    if (!period?.months) return { start: 0, end: 100 };
    const now      = Date.now();
    const fromTs   = now - period.months * 30.44 * 24 * 60 * 60 * 1000;
    const firstTs  = data[0][0];
    const lastTs   = data[data.length - 1][0];
    const startPct = Math.max(0, ((fromTs - firstTs) / (lastTs - firstTs)) * 100);
    return { start: startPct, end: 100 };
  }, [data, activePeriod]);

  /* ─── buildOption (useCallback!) ─── */
  const buildOption = useCallback((zoom) => {
    if (!data || data.length === 0) return null;
    const z = zoom || zoomRange;

    const timestamps = data.map(([ts]) => new Date(ts).toISOString().split('T')[0]);
    const closes     = data.map(([, c]) => c);

    // Quantos dias visíveis no zoom atual
    const spanDays = Math.round(((z.end - z.start) / 100) * timestamps.length);

    // Formatter do eixo X adaptativo
    const xLabelFormatter = (val) => {
      const d     = new Date(val);
      const month = d.getMonth();
      const year  = d.getFullYear();
      const day   = d.getDate();

      if (spanDays > 365 * 3) {
        return month === 0 ? String(year) : '';
      } else if (spanDays > 180) {
        if (month === 0)      return String(year);
        if (month % 3 === 0)  return MONTHS_PT[month];
        return '';
      } else if (spanDays > 60) {
        return month === 0 ? String(year) : MONTHS_PT[month];
      } else {
        if (day === 1) return MONTHS_PT[month] + (month === 0 ? '\n' + year : '');
        if ([8, 15, 22].includes(day)) return String(day);
        return '';
      }
    };

    // Intervalo de labels no eixo X
    const xInterval = spanDays > 365 * 3 ? Math.floor(timestamps.length / 16)
                    : spanDays > 180     ? Math.floor(spanDays / 6)
                    : spanDays > 60      ? Math.floor(spanDays / 7)
                    : 'auto';

    const halvingLines = HALVINGS
      .filter(h => timestamps.includes(h.date))
      .map(h => ({
        xAxis: h.date,
        label: {
          formatter: h.label,
          color: '#f7931a',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
          padding: [3, 5],
          backgroundColor: 'rgba(247,147,26,0.12)',
          borderRadius: 3,
        },
        lineStyle: { color: 'rgba(247,147,26,0.35)', type: 'dashed', width: 1 },
      }));

    // Bounds para escala log baseados nos dados visíveis
    const i0v = Math.floor((z.start / 100) * (data.length - 1));
    const i1v = Math.ceil((z.end   / 100) * (data.length - 1));
    const visiblePrices = data.slice(i0v, i1v + 1).map(d => d[1]).filter(v => v > 0);
    const logBounds = isLog && visiblePrices.length ? {
      min: Math.pow(10, Math.log10(Math.min(...visiblePrices)) - 0.1),
      max: Math.pow(10, Math.log10(Math.max(...visiblePrices)) + 0.1),
    } : { scale: true };

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: { top: 20, left: 72, right: 24, bottom: 80 },

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
        textStyle: { color: '#e8e8f0', fontFamily: 'DM Sans, sans-serif', fontSize: 13 },
        formatter(params) {
          const p = params[0];
          if (!p) return '';
          const halving    = HALVINGS.find(h => h.date === p.axisValue);
          const halvingNote = halving
            ? `<div style="color:#f7931a;font-size:11px;margin-top:6px;font-family:JetBrains Mono,monospace">⬡ ${halving.label} · ${halving.reward}</div>`
            : '';
          return `
            <div style="font-family:JetBrains Mono,monospace;font-size:11px;color:#9090b0;margin-bottom:4px">${formatDateTooltip(p.axisValue)}</div>
            <div style="font-size:17px;font-weight:700;color:#e8e8f0;letter-spacing:-0.02em">${formatPriceFull(p.value)}</div>
            ${halvingNote}
          `;
        },
      },

      xAxis: {
        type: 'category',
        data: timestamps,
        axisLine: { lineStyle: { color: '#1e1e35' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#5a5a80',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          margin: 10,
          showMinLabel: true,
          showMaxLabel: false,
          interval: xInterval,
          formatter: xLabelFormatter,
        },
        splitLine: { show: false },
        boundaryGap: false,
      },

      yAxis: {
        type: isLog ? 'log' : 'value',
        logBase: 10,
        ...(isLog ? logBounds : { scale: true }),
        name: 'Preço (USD)', nameLocation: 'middle', nameGap: 56,
        nameTextStyle: { color: '#5a5a80', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#5a5a80',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          formatter: formatPrice,
        },
        splitLine: { lineStyle: { color: '#1e1e35', type: 'dashed' } },
      },

      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          bottom: 10,
          height: 44,
          start: z.start,
          end: z.end,
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
          labelFormatter(val, str) { return str ? str.substring(0, 7) : ''; },
        },
        {
          type: 'inside',
          xAxisIndex: 0,
          start: z.start,
          end: z.end,
        },
      ],

      series: [{
        type: 'line',
        data: closes,
        smooth: false,
        symbol: 'none',
        lineStyle: { color: '#f7931a', width: 1.5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(247,147,26,0.18)' },
              { offset: 1, color: 'rgba(247,147,26,0.00)' },
            ],
          },
        },
        markLine: halvingLines.length > 0 ? {
          silent: false,
          symbol: ['none', 'none'],
          data: halvingLines,
        } : undefined,
      }],
    };
  }, [data, isLog, zoomRange]);

  // ── Init ──
  useEffect(() => {
    if (!echartsReady || !chartRef.current || !data?.length) return;
    const init = async () => {
      const echarts = await import('echarts');
      let chart = chartInst.current;
      if (!chart) {
        chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        chartInst.current = chart;
        new ResizeObserver(() => chart.resize()).observe(chartRef.current);

        // Debounced zoom handler — updates Y bounds without resetting slider position
        let zoomTimer = null;
        chart.on('datazoom', () => {
          clearTimeout(zoomTimer);
          zoomTimer = setTimeout(() => {
            const opt = chart.getOption();
            const dz  = opt?.dataZoom?.[0];
            if (!dz) return;
            const start = dz.start ?? 0;
            const end   = dz.end   ?? 100;
            setCurrentZoom({ start, end });
          }, 150);
        });
      }
      const option = buildOption();
      if (option) chart.setOption(patchOption(option, isDark), { notMerge: true });
    };
    init();
  }, [echartsReady, data?.length]);

  // ── Update (period, log/linear, theme) ──
  useEffect(() => {
    const chart = chartInst.current;
    if (!chart) return;
    const option = buildOption();
    if (option) chart.setOption(patchOption(option, isDark), { notMerge: true });
  }, [buildOption, isDark]);

  // ── Zoom-only Y-axis update (no slider reset) ──
  useEffect(() => {
    const chart = chartInst.current;
    if (!chart || !data?.length) return;
    const option = buildOption(currentZoom);
    if (!option) return;
    // Only update yAxis — do NOT touch dataZoom to avoid snap-back
    chart.setOption(patchOption({ yAxis: option.yAxis }, isDark), { notMerge: false, replaceMerge: [] });
  }, [currentZoom, isDark]);

  // Stats — ATH usa high (índice 2), com fallback para close
  const stats = useMemo(() => {
    if (!data || data.length === 0) return {};
    const latest   = data[data.length - 1][1];
    const prev     = data[data.length - 2]?.[1];
    const change24 = prev ? ((latest - prev) / prev) * 100 : null;

    // ATH fixo — valor intraday confirmado, não depende do JSON de fechamento
    const ath      = 126219;
    const athDate  = new Date('2025-10-06T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const fromAth  = ((latest - ath) / ath) * 100;

    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const yearEntry  = data.reduce((p, c) => Math.abs(c[0] - oneYearAgo) < Math.abs(p[0] - oneYearAgo) ? c : p);
    const change1y   = ((latest - yearEntry[1]) / yearEntry[1]) * 100;

    return { latest, change24, ath, athDate, fromAth, change1y };
  }, [data]);

  const isUp = stats.change24 != null && stats.change24 >= 0;

  return (
    <div className="price-chart-wrapper">
      <div className="chart-header">
        <div className="chart-price-info">
          {stats.latest ? (
            <>
              <span className="current-price">{formatPriceFull(stats.latest)}</span>
              {stats.change24 != null && (
                <span className={`price-change ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '▲' : '▼'} {Math.abs(stats.change24).toFixed(2)}%
                  <span className="change-label">24h</span>
                </span>
              )}
            </>
          ) : (
            <span className="price-placeholder">—</span>
          )}
        </div>
        <div className="chart-controls">
          <div className="period-selector">
            {PERIODS.map(p => (
              <button
                key={p.label}
                className={`period-btn ${activePeriod === p.label ? 'active' : ''}`}
                onClick={() => setActivePeriod(p.label)}
              >{p.label}</button>
            ))}
          </div>
          <div className="scale-toggle">
            <button className={`scale-btn ${isLog ? 'active' : ''}`}  onClick={() => setIsLog(true)}>LOG</button>
            <button className={`scale-btn ${!isLog ? 'active' : ''}`} onClick={() => setIsLog(false)}>LINEAR</button>
          </div>
        </div>
      </div>

      <div className="chart-area">
        {loading && (
          <div className="chart-state">
            <div className="spinner" />
            <span>Carregando dados históricos...</span>
          </div>
        )}
        {error && (
          <div className="chart-state error">
            <span>⚠ {error}</span>
            <p>Execute <code>node scripts/fetch-history.mjs</code> para baixar os dados.</p>
          </div>
        )}
        {!loading && !error && (!data || data.length === 0) && (
          <div className="chart-state"><span>Sem dados disponíveis.</span></div>
        )}
        <div ref={chartRef} className="echarts-canvas" style={{ opacity: loading || error ? 0 : 1 }} />
      </div>

      {data && data.length > 0 && (
        <div className="chart-footer">
          <span>{data.length.toLocaleString('pt-BR')} dias de dados</span>
          <span>·</span>
          <span>
            {new Date(data[0][0]).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            {' → '}
            {new Date(data[data.length - 1][0]).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
          </span>
          <span>·</span>
          <span>Fonte: Yahoo Finance / CSV histórico</span>
          <span>·</span>
          <span>Fechamento diário (USD)</span>
        </div>
      )}

      <style jsx>{`
        .price-chart-wrapper { display: flex; flex-direction: column; height: 100%; }
        .chart-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px 12px; border-bottom: 1px solid var(--border-subtle);
          flex-wrap: wrap; gap: 12px;
        }
        .chart-price-info { display: flex; align-items: baseline; gap: 12px; }
        .current-price {
          font-family: var(--font-display); font-size: 24px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.02em;
        }
        .price-placeholder { font-family: var(--font-mono); font-size: 20px; color: var(--text-muted); }
        .price-change {
          display: flex; align-items: center; gap: 4px; font-family: var(--font-mono);
          font-size: 13px; font-weight: 500; padding: 3px 8px; border-radius: 4px;
        }
        .price-change.up   { color: #22c55e; background: rgba(34,197,94,0.1); }
        .price-change.down { color: #ef4444; background: rgba(239,68,68,0.1); }
        .change-label { font-size: 10px; opacity: 0.7; margin-left: 2px; }
        .chart-controls { display: flex; align-items: center; gap: 10px; }
        .period-selector, .scale-toggle {
          display: flex; background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-subtle); border-radius: 6px; overflow: hidden;
        }
        .period-btn, .scale-btn {
          padding: 5px 10px; font-family: var(--font-mono); font-size: 11px; font-weight: 500;
          letter-spacing: 0.04em; color: var(--text-muted); background: none; border: none;
          border-right: 1px solid var(--border-subtle); cursor: pointer;
          transition: color 0.15s, background 0.15s;
        }
        .period-btn:last-child, .scale-btn:last-child { border-right: none; }
        .period-btn:hover, .scale-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.04); }
        .period-btn.active, .scale-btn.active { color: var(--brand-orange); background: rgba(247,147,26,0.1); }
        .scale-btn { letter-spacing: 0.06em; font-size: 10px; }
        .chart-area { flex: 1; position: relative; min-height: 420px; }
        .echarts-canvas { width: 100%; height: 100%; min-height: 420px; transition: opacity 0.3s ease; }
        .chart-state {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px;
          color: var(--text-muted); font-family: var(--font-mono); font-size: 13px; z-index: 10;
        }
        .chart-state.error { color: #ef4444; }
        .chart-state p { font-size: 11px; color: var(--text-muted); text-align: center; }
        .chart-state code { background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 3px; }
        .spinner {
          width: 24px; height: 24px; border: 2px solid var(--border-subtle);
          border-top-color: var(--brand-orange); border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .chart-footer {
          display:flex; align-items:center; justify-content:flex-end;
          gap:8px; padding:8px 20px; font-family:var(--font-mono);
          font-size:9px; color:var(--text-muted); flex-wrap:wrap;
        }
      `}</style>
    </div>
  );
}
