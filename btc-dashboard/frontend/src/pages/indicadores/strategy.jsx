import { useState, useEffect } from 'react';
import Layout  from '../../components/Layout';
import StrategyChart from '../../components/charts/StrategyChart';
import { Building2 } from 'lucide-react';

export default function StrategyPage() {
  const [strategyData, setStrategyData] = useState(null);
  const [priceData, setPriceData]       = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/strategy').then(r => r.json()),
      fetch('/api/price').then(r => r.json()),
    ])
      .then(([strat, price]) => {
        setStrategyData(Array.isArray(strat) ? strat : []);
        const priceArr = price?.data ?? (Array.isArray(price) ? price : []);
        setPriceData(priceArr);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <Layout title="Strategy" subtitle="Holdings e custo médio da Strategy (MSTR)">
      <div className="page-layout">
        <div className="page-header">
          <div className="page-icon">
            <Building2 size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="page-title">Strategy (MSTR)</h1>
            <p className="page-sub">Holdings e custo médio da Strategy · Maior reserva corporativa de BTC do mundo</p>
          </div>
        </div>

        <div className="page-card">
          <StrategyChart
            strategyData={strategyData}
            priceData={priceData}
            loading={loading}
            error={error}
          />
        </div>

        <div className="info-panel">
          <div className="info-section">
            <h3>O que é</h3>
            <p>
              <strong>Esse gráfico mostra a posição em BTC da Strategy</strong> (anteriormente
              MicroStrategy / MSTR), maior empresa de entesouramento de bitcoin do mundo, chefiada
              por Michael Saylor.
            </p>
            <p>
              A linha laranja é o preço de mercado do Bitcoin. A linha tracejada é o custo médio de
              aquisição da Strategy — o preço médio que a empresa pagou por todos os seus BTC. Na
              parte inferior, em laranja, temos o total de BTC que a empresa detém.
            </p>
            <p>
              Quando o preço está acima da linha tracejada, a empresa está no lucro. Quando está
              abaixo, no prejuízo.
            </p>
            <p>
              É possível também visualizar as compras que a empresa fez ao longo do tempo.
            </p>
          </div>
        </div>

      </div>

      <style jsx>{`
        .page-layout {
          max-width: 1200px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .page-header {
          display: flex; align-items: center; gap: 12px;
        }
        .page-icon {
          width: 36px; height: 36px; flex-shrink: 0;
          background: rgba(247,147,26,0.1); border: 1px solid rgba(247,147,26,0.2);
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
          color: var(--brand-orange);
        }
        .page-title {
          font-family: var(--font-display); font-size: 22px; font-weight: 800;
          color: var(--text-primary); letter-spacing: -0.02em; line-height: 1.1;
        }
        .page-sub {
          font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);
          margin-top: 2px; letter-spacing: 0.02em;
        }
        .page-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          overflow: hidden;
        }
        .info-panel {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        .info-section {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 20px 24px;
        }
        .info-section h3 {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0 0 12px;
        }
        .info-section p {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.7;
          margin: 0 0 8px;
        }
        .info-section strong { color: var(--text-secondary); }
      `}</style>
    </Layout>
  );
}
