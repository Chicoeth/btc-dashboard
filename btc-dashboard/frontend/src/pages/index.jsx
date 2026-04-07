import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import Link from 'next/link';
import {
  TrendingUp, Activity, BarChart2, Users, Divide,
  GitCompareArrows, Building2, Landmark, ArrowRight,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

/* ── helpers ── */
const fmt = (v) =>
  v == null
    ? '—'
    : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtK = (v) => {
  if (v == null) return '—';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

const fmtPct = (v) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/* FNG classification */
function fngLabel(val) {
  if (val <= 25) return { text: 'Medo Extremo', color: '#ef4444' };
  if (val <= 45) return { text: 'Medo', color: '#f59e0b' };
  if (val <= 55) return { text: 'Neutro', color: '#a3a3a3' };
  if (val <= 75) return { text: 'Ganância', color: '#84cc16' };
  return { text: 'Ganância Extrema', color: '#22c55e' };
}

/* MVRV color */
function mvrvColor(val) {
  if (val == null) return '#9090b0';
  if (val < 1.0) return 'rgb(0,196,79)';
  if (val > 3.0) return 'rgb(232,0,10)';
  const t = (val - 1.0) / 2.0;
  if (t <= 0.5) {
    const r = Math.round(0 + (255 - 0) * (t / 0.5));
    const g = Math.round(196 + (220 - 196) * (t / 0.5));
    return `rgb(${r},${g},0)`;
  }
  const r = Math.round(255 - (255 - 232) * ((t - 0.5) / 0.5));
  const g = Math.round(220 * (1 - (t - 0.5) / 0.5));
  return `rgb(${r},${g},${Math.round(10 * ((t - 0.5) / 0.5))})`;
}

/* Mayer color */
function mayerColor(val) {
  if (val == null) return '#9090b0';
  if (val <= 0.6) return 'rgb(0,196,79)';
  if (val >= 2.0) return 'rgb(232,0,10)';
  const t = (val - 0.6) / 1.4;
  if (t <= 0.5) {
    const r = Math.round(255 * (t / 0.5));
    const g = Math.round(196 + (220 - 196) * (t / 0.5));
    return `rgb(${r},${g},0)`;
  }
  const r = Math.round(255 - 23 * ((t - 0.5) / 0.5));
  const g = Math.round(220 * (1 - (t - 0.5) / 0.5));
  return `rgb(${r},${g},${Math.round(10 * ((t - 0.5) / 0.5))})`;
}

/* STH MVRV color */
function sthMvrvColor(val) {
  if (val == null) return '#9090b0';
  if (val <= 0.75) return 'rgb(0,196,79)';
  if (val >= 1.35) return 'rgb(232,0,10)';
  const t = (val - 0.75) / 0.6;
  if (t <= 0.5) {
    const r = Math.round(255 * (t / 0.5));
    const g = Math.round(196 + 24 * (t / 0.5));
    return `rgb(${r},${g},0)`;
  }
  const r = Math.round(255 - 23 * ((t - 0.5) / 0.5));
  const g = Math.round(220 * (1 - (t - 0.5) / 0.5));
  return `rgb(${r},${g},${Math.round(10 * ((t - 0.5) / 0.5))})`;
}

/* ── data hook ── */
function useDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [priceRes, fngRes, mvrvRes, sthRes, stratRes, etfRes] = await Promise.all([
          fetch('/api/price'),
          fetch('/api/fng'),
          fetch('/api/mvrv'),
          fetch('/api/sth-mvrv'),
          fetch('/api/strategy'),
          fetch('/api/etf-holdings'),
        ]);

        const priceRaw = await priceRes.json();
        const price = Array.isArray(priceRaw) ? priceRaw : (priceRaw?.data ?? []);
        const fng = await fngRes.json();
        const mvrv = await mvrvRes.json();
        const sth = await sthRes.json();
        const strategy = await stratRes.json();
        const etf = await etfRes.json();

        setData({ price, fng, mvrv, sth, strategy, etf });
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { data, loading };
}

/* ── indicator cards config ── */
const INDICATORS = [
  {
    key: 'price',
    label: 'Preço BTC',
    icon: TrendingUp,
    href: '/mercado/preco',
    extract: (d) => {
      if (!d?.price?.length) return null;
      const last = d.price[d.price.length - 1];
      const prev = d.price.length >= 2 ? d.price[d.price.length - 2] : null;
      const price = last[1];
      const change = prev ? ((price - prev[1]) / prev[1]) * 100 : null;
      return { value: fmt(price), sub: change != null ? fmtPct(change) : '', change, color: '#f7931a' };
    },
  },
  {
    key: 'fng',
    label: 'Medo & Ganância',
    icon: Activity,
    href: '/indicadores/medo-ganancia',
    extract: (d) => {
      if (!d?.fng?.length) return null;
      const last = d.fng[d.fng.length - 1];
      const val = last[1];
      const info = fngLabel(val);
      return { value: `${val}`, sub: info.text, color: info.color };
    },
  },
  {
    key: 'mvrv',
    label: 'MVRV',
    icon: BarChart2,
    href: '/indicadores/mvrv',
    extract: (d) => {
      if (!d?.mvrv?.length) return null;
      const last = d.mvrv[d.mvrv.length - 1];
      const val = last[3];
      return { value: val?.toFixed(2), sub: val < 1 ? 'Subvalorizado' : val > 3 ? 'Sobrevalorizado' : 'Neutro', color: mvrvColor(val) };
    },
  },
  {
    key: 'sth',
    label: 'STH MVRV',
    icon: Users,
    href: '/indicadores/sth-mvrv',
    extract: (d) => {
      if (!d?.sth?.length) return null;
      const last = d.sth[d.sth.length - 1];
      const val = last[3];
      return { value: val?.toFixed(2), sub: val < 1 ? 'STH em prejuízo' : 'STH em lucro', color: sthMvrvColor(val) };
    },
  },
  {
    key: 'mayer',
    label: 'Múltiplo de Mayer',
    icon: Divide,
    href: '/indicadores/multiplo-mayer',
    extract: (d) => {
      if (!d?.price?.length) return null;
      // calc SMA 200
      const prices = d.price.map((p) => p[1]);
      if (prices.length < 200) return null;
      const sma200 = prices.slice(-200).reduce((a, b) => a + b, 0) / 200;
      const current = prices[prices.length - 1];
      const mayer = current / sma200;
      return { value: mayer.toFixed(2), sub: `SMA 200: ${fmt(sma200)}`, color: mayerColor(mayer) };
    },
  },
  {
    key: 'cycle',
    label: 'Ciclo Atual',
    icon: GitCompareArrows,
    href: '/indicadores/comparador-ciclos',
    extract: (d) => {
      if (!d?.price?.length) return null;
      // Days since last halving (2024-04-19)
      const halvingDate = new Date('2024-04-19T00:00:00Z').getTime();
      const lastTs = d.price[d.price.length - 1][0];
      const daysSince = Math.floor((lastTs - halvingDate) / (24 * 60 * 60 * 1000));
      return { value: `Dia ${daysSince}`, sub: 'Pós-halving #4', color: '#f7931a' };
    },
  },
  {
    key: 'strategy',
    label: 'Strategy (MSTR)',
    icon: Building2,
    href: '/indicadores/strategy',
    extract: (d) => {
      if (!d?.strategy?.length) return null;
      const last = d.strategy[d.strategy.length - 1];
      const holdings = last[1];
      return { value: `${fmtK(holdings)} BTC`, sub: `Custo médio: ${fmt(last[2])}`, color: '#f7931a' };
    },
  },
  {
    key: 'etf',
    label: 'ETFs de Bitcoin',
    icon: Landmark,
    href: '/indicadores/etf-holdings',
    extract: (d) => {
      if (!d?.etf?.length) return null;
      const last = d.etf[d.etf.length - 1];
      const total = last[2];
      return { value: `${fmtK(total)} BTC`, sub: '11 ETFs dos EUA', color: '#3b82f6' };
    },
  },
];

export default function HomePage() {
  const { data, loading } = useDashboardData();

  return (
    <Layout>
      <div className="home">
        {/* Header */}
        <div className="home-header">
          <h1 className="home-title">
            Dashboard de Métricas
            <br />
            <span className="title-accent">do Bitcoin</span>
          </h1>
          <p className="home-subtitle">
            Visualização abrangente de dados on-chain, métricas de mercado e indicadores
            fundamentais para análise do Bitcoin. Dados históricos completos, atualizados diariamente.
          </p>
        </div>

        {/* Indicators Overview */}
        <div className="section-header">
          <h2 className="section-title">Visão Geral dos Indicadores</h2>
          <p className="section-desc">
            Último valor de cada indicador do dashboard. Clique para ver o gráfico completo.
          </p>
        </div>

        <div className="indicators-grid">
          {INDICATORS.map((ind) => {
            const Icon = ind.icon;
            const extracted = data ? ind.extract(data) : null;
            const isLoading = loading || !extracted;

            return (
              <Link key={ind.key} href={ind.href} className="indicator-card card">
                <div className="indicator-header">
                  <div className="indicator-icon">
                    <Icon size={16} strokeWidth={1.5} />
                  </div>
                  <ArrowRight size={13} className="indicator-arrow" />
                </div>

                <div className="indicator-label">{ind.label}</div>

                {isLoading ? (
                  <div className="indicator-skeleton">
                    <div className="skeleton-line skeleton-value" />
                    <div className="skeleton-line skeleton-sub" />
                  </div>
                ) : (
                  <>
                    <div className="indicator-value" style={{ color: extracted.color }}>
                      {extracted.value}
                      {extracted.change != null && (
                        <span className={`indicator-change ${extracted.change >= 0 ? 'positive' : 'negative'}`}>
                          {extracted.change >= 0
                            ? <ArrowUpRight size={12} strokeWidth={2} />
                            : <ArrowDownRight size={12} strokeWidth={2} />
                          }
                          {Math.abs(extracted.change).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="indicator-sub">{extracted.sub}</div>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .home {
          max-width: 1100px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        /* Header */
        .home-header {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .home-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 3.5vw, 40px);
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.15;
          letter-spacing: -0.02em;
        }

        .title-accent {
          color: var(--brand-orange);
        }

        .home-subtitle {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.7;
          max-width: 580px;
        }

        /* Section header */
        .section-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .section-desc {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* Indicators Grid */
        .indicators-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .indicator-card {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.2s ease, border-color 0.2s ease;
          position: relative;
        }

        .indicator-card:hover {
          transform: translateY(-2px);
          border-color: var(--border-bright);
        }

        .indicator-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .indicator-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(247, 147, 26, 0.08);
          border: 1px solid rgba(247, 147, 26, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-orange);
        }

        .indicator-arrow {
          color: var(--text-muted);
          opacity: 0;
          transition: opacity 0.2s;
        }

        .indicator-card:hover .indicator-arrow {
          opacity: 1;
        }

        .indicator-label {
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }

        .indicator-value {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          line-height: 1.1;
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .indicator-change {
          font-family: var(--font-mono);
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 1px;
        }

        .indicator-change.positive { color: #22c55e; }
        .indicator-change.negative { color: #ef4444; }

        .indicator-sub {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono);
          letter-spacing: 0.01em;
        }

        /* Skeleton loading */
        .indicator-skeleton {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .skeleton-line {
          border-radius: 4px;
          background: var(--border-subtle);
          animation: pulse 1.5s ease-in-out infinite;
        }

        .skeleton-value {
          width: 80px;
          height: 22px;
        }

        .skeleton-sub {
          width: 100px;
          height: 12px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }

        /* Responsive */
        @media (max-width: 900px) {
          .indicators-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 480px) {
          .indicators-grid {
            grid-template-columns: 1fr;
          }
          .indicator-value {
            font-size: 20px;
          }
        }
      `}</style>
    </Layout>
  );
}
