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
            <p className="page-sub">
              Performance normalizada dos ciclos de alta, baixa e halvings do Bitcoin
            </p>
          </div>
        </div>

        <div className="page-card">
          <CycleChart priceData={priceData} loading={loading} error={error} />
        </div>

        <div className="info-panel">
          <div className="info-section">
            <h3>O que é</h3>
            <p>
              <strong>Temos aqui uma maneira de comparar os ciclos do BTC</strong> — tanto o ciclo
              completo, quanto os ciclos de alta e de baixa.
            </p>
            <p>
              Na "Performance a partir do Halving", temos uma visão completa do trajeto do BTC em
              cada ciclo. Em "Ciclos de Alta", comparamos os ciclos do BTC a partir do fundo, até o
              topo — sendo uma visualização dos ciclos de alta. Em "Ciclos de Baixa", comparamos os
              ciclos do BTC a partir do topo, até o fundo — sendo uma visualização dos ciclos de baixa.
            </p>
            <p>
              O preço é normalizado em 1 no início de cada ciclo, permitindo a comparação. Um valor
              de 2 indica que o preço subiu 2x (+100%), um valor de 10 que o preço subiu 10x (+900%),
              e um valor de 0.4x indica que o preço caiu 60% (ou que foi multiplicado por 0,4).
            </p>
            <p>
              É possível adicionar uma média dos ciclos em visualização, assim como um desvio padrão
              da média — de maneira a ajudar a analisar a trajetória esperada de cada ciclo.
            </p>
          </div>

          <div className="info-section">
            <h3>Como usar</h3>
            <p>
              O BTC tem uma natureza cíclica. Padrões tendem a se repetir a cada ciclo. Observar
              esses padrões pode ser útil para tentar prever momentos de compra e venda.
            </p>
            <p>
              Por exemplo, a duração temporal de todos os ciclos de alta e de baixa, até hoje, tem
              sido muito similar — como dá para perceber nos gráficos.
            </p>
            <p>
              Também há uma tendência histórica, em que a cada ciclo de alta o BTC sobe menos, e a
              cada ciclo de baixa o BTC cai menos.
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
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 900px) { .info-panel { grid-template-columns: 1fr; } }
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
