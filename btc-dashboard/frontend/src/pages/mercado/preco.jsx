/**
 * pages/mercado/preco.jsx
 * Página: Preço Histórico do BTC
 */

import Layout from '../../components/Layout';
import PriceChart from '../../components/charts/PriceChart';
import { usePriceData } from '../../hooks/usePriceData';
import { TrendingUp, Info } from 'lucide-react';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : {}}>
        {value ?? <span className="stat-empty">—</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}

      <style jsx>{`
        .stat-card {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .stat-label {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .stat-value {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .stat-empty {
          color: var(--text-muted);
          font-size: 18px;
        }
        .stat-sub {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

function fmt(value, decimals = 2) {
  if (value == null) return null;
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(value) {
  if (value == null) return null;
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(2) + '%';
}

export default function PrecoPage() {
  const { data, loading, error } = usePriceData();

  // Compute quick stats from data
  const stats = (() => {
    if (!data || data.length === 0) return {};

    const latest  = data[data.length - 1][1];
    const prev24h = data[data.length - 2]?.[1];
    const change24h = prev24h ? ((latest - prev24h) / prev24h) * 100 : null;

    // ATH usa o high diário (índice 2), com fallback para close
    let ath = 0, athIdx = 0;
    for (let i = 0; i < data.length; i++) {
      const h = data[i][2] ?? data[i][1];
      if (h > ath) { ath = h; athIdx = i; }
    }
    const athDate = new Date(data[athIdx][0]).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    const fromAth = ((latest - ath) / ath) * 100;

    // 1 year ago
    const oneYearAgo = data[data.length - 1][0] - 365 * 24 * 60 * 60 * 1000;
    const yearAgoEntry = data.reduce((prev, curr) => Math.abs(curr[0] - oneYearAgo) < Math.abs(prev[0] - oneYearAgo) ? curr : prev);
    const change1y = ((latest - yearAgoEntry[1]) / yearAgoEntry[1]) * 100;

    const atl = Math.min(...data.map(([,c]) => c));

    return { latest, change24h, ath, athDate, fromAth, change1y, atl };
  })();

  return (
    <Layout>
      <div className="preco-page">
        {/* Page header */}
        <div className="page-header">
          <div className="page-title-row">
            <div className="page-icon">
              <TrendingUp size={16} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="page-title">Preço Histórico</h1>
              <p className="page-desc">Preço de fechamento diário do Bitcoin em USD, desde 2012</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="stats-grid">
          <StatCard
            label="Preço Atual"
            value={fmt(stats.latest)}
            sub="Fechamento mais recente"
          />
          <StatCard
            label="Variação 24h"
            value={fmtPct(stats.change24h)}
            color={stats.change24h >= 0 ? '#22c55e' : '#ef4444'}
            sub="Dia anterior"
          />
          <StatCard
            label="ATH"
            value={fmt(stats.ath)}
            sub={stats.athDate}
          />
          <StatCard
            label="Dist. do ATH"
            value={fmtPct(stats.fromAth)}
            color={stats.fromAth >= 0 ? '#22c55e' : '#ef4444'}
            sub="Preço atual vs ATH"
          />
          <StatCard
            label="Retorno 1 Ano"
            value={fmtPct(stats.change1y)}
            color={stats.change1y >= 0 ? '#22c55e' : '#ef4444'}
            sub="Variação anual"
          />
        </div>

        {/* Main chart */}
        <div className="chart-card card">
          <PriceChart data={data} loading={loading} error={error} />
        </div>

        {/* Info note */}
        <div className="info-note">
          <Info size={13} strokeWidth={1.5} />
          <span>
            As linhas verticais laranjas marcam os <strong>Halvings</strong> — eventos onde a recompensa
            de bloco do Bitcoin é reduzida à metade, historicamente associados a ciclos de alta.
            Escala logarítmica recomendada para visualizar o crescimento percentual ao longo do tempo.
          </span>
        </div>
      </div>

      <style jsx>{`
        .preco-page {
          max-width: 1200px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Page header */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .page-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .page-icon {
          width: 36px;
          height: 36px;
          background: rgba(247,147,26,0.1);
          border: 1px solid rgba(247,147,26,0.2);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-orange);
          flex-shrink: 0;
        }

        .page-title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .page-desc {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        /* Chart */
        .chart-card {
          min-height: 520px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Info note */
        .info-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.6;
          padding: 12px 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
        }

        .info-note :global(svg) {
          flex-shrink: 0;
          margin-top: 1px;
          color: var(--text-muted);
        }

        .info-note strong {
          color: var(--text-secondary);
          font-weight: 500;
        }

        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 600px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </Layout>
  );
}
