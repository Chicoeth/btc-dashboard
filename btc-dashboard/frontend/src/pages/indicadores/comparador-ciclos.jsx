/**
 * pages/indicadores/comparador-ciclos.jsx
 */

import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import CycleChart from '../../components/charts/CycleChart';
import { GitCompare } from 'lucide-react';

export default function ComparadorCiclosPage() {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    fetch('/api/price')
      .then(r => r.json())
      .then(d => {
        setPriceData(Array.isArray(d) ? d : (d?.data ?? []));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <Layout>
      <div className="page-layout">
        <div className="page-header">
          <div className="page-icon">
            <GitCompare size={16} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="page-title">Comparador de Ciclos</h1>
            <p className="page-desc">
              Performance normalizada dos ciclos de alta, baixa e halvings do Bitcoin
            </p>
          </div>
        </div>

        <div className="chart-card card">
          <CycleChart priceData={priceData} loading={loading} error={error} />
        </div>

        <div className="info-grid">
          <div className="info-card card">
            <h3>Como funciona</h3>
            <p>
              O preço do BTC é normalizado em <strong>1×</strong> no início de cada ciclo,
              permitindo comparar o comportamento percentual entre períodos distintos de forma direta.
            </p>
            <p>
              Um valor de <strong>10×</strong> significa que o preço multiplicou 10 vezes desde o início
              daquele ciclo. A escala logarítmica é usada para que crescimentos exponenciais fiquem
              visualmente comparáveis.
            </p>
          </div>

          <div className="info-card card">
            <h3>Ciclos de Alta</h3>
            <p>Normalizados no fundo de cada ciclo de baixa (mínimo histórico do ciclo).</p>
            <div className="cycle-list">
              <div className="cycle-row"><span className="dot" style={{ background: '#f7931a' }} />Ciclo 1: Nov/2011 ($1.99) → Dez/2013 ($1.240)</div>
              <div className="cycle-row"><span className="dot" style={{ background: '#3b82f6' }} />Ciclo 2: Jan/2015 ($166) → Dez/2017 ($19.804)</div>
              <div className="cycle-row"><span className="dot" style={{ background: '#22c55e' }} />Ciclo 3: Dez/2018 ($3.124) → Nov/2021 ($68.997)</div>
              <div className="cycle-row"><span className="dot" style={{ background: '#a855f7' }} />Ciclo 4: Nov/2022 ($15.473) → Out/2025 ($126.219)</div>
            </div>
          </div>

          <div className="info-card card">
            <h3>Ciclos de Baixa</h3>
            <p>Normalizados no topo de cada ciclo de alta (máximo histórico do ciclo).</p>
            <div className="cycle-list">
              <div className="cycle-row"><span className="dot" style={{ background: '#f7931a' }} />Baixa 1: Dez/2013 → Jan/2015 (-87%)</div>
              <div className="cycle-row"><span className="dot" style={{ background: '#3b82f6' }} />Baixa 2: Dez/2017 → Dez/2018 (-84%)</div>
              <div className="cycle-row"><span className="dot" style={{ background: '#22c55e' }} />Baixa 3: Nov/2021 → Nov/2022 (-78%)</div>
              <div className="cycle-row"><span className="dot" style={{ background: '#a855f7' }} />Baixa 4: Out/2025 → ??? (atual)</div>
            </div>
          </div>

          <div className="info-card card">
            <h3>Halvings</h3>
            <p>Normalizados no dia de cada halving. Permite ver como o BTC se comportou nos ~4 anos entre cada evento de redução da emissão.</p>
            <div className="cycle-list">
              <div className="cycle-row"><span className="dot" style={{ background: '#f7931a' }} />Halving 1: Nov/2012 → Jul/2016</div>
              <div className="cycle-row"><span className="dot" style={{ background: '#3b82f6' }} />Halving 2: Jul/2016 → Mai/2020</div>
              <div className="cycle-row"><span className="dot" style={{ background: '#22c55e' }} />Halving 3: Mai/2020 → Abr/2024</div>
              <div className="cycle-row"><span className="dot" style={{ background: '#a855f7' }} />Halving 4: Abr/2024 → ??? (atual)</div>
            </div>
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

        .chart-card {
          overflow: hidden;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .info-card {
          padding: 18px 20px;
        }

        .info-card h3 {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 0 0 10px;
        }

        .info-card p {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.65;
          margin: 0 0 8px;
        }

        .info-card strong {
          color: var(--text-secondary);
        }

        .cycle-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 8px;
        }

        .cycle-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-secondary);
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        @media (max-width: 800px) {
          .info-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </Layout>
  );
}
