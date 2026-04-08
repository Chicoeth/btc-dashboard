import { useState, useEffect } from 'react';
import Layout  from '../../components/Layout';
import STHMVRVChart from '../../components/charts/STHMVRVChart';
import { Users } from 'lucide-react';

export default function STHMVRVPage() {
  const [sthData, setSthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/sth-mvrv')
      .then(r => r.json())
      .then(d => {
        setSthData(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <Layout title="STH MVRV" subtitle="Short-Term Holder MVRV · Sentimento dos detentores de curto prazo">
      <div className="page-layout">
        <div className="page-header">
          <div className="page-icon">
            <Users size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="page-title">STH MVRV</h1>
            <p className="page-sub">Short-Term Holder MVRV · Sentimento dos detentores de curto prazo</p>
          </div>
        </div>

        <div className="page-card">
          <STHMVRVChart sthMvrvData={sthData} loading={loading} error={error} />
        </div>

        <div className="info-panel">
          <div className="info-section">
            <h3>O que é</h3>
            <p>
              <strong>O STH MVRV (Short-Term Holder Market Value to Realized Value) é uma medida do
              lucro ou prejuízo não realizado dos detentores de curto prazo do BTC.</strong>
            </p>
            <p>
              É bem similar ao MVRV, mas ele compara o preço de mercado do Bitcoin com o "Preço Realizado
              dos Detentores de Curto Prazo" — que só considera as moedas movidas nos últimos 155 dias,
              fazendo um "custo médio global" dos detentores de curto prazo.
            </p>
            <p>
              Enquanto o MVRV tradicional aponta o lucro/prejuízo de todos os detentores de BTC, o STH
              MVRV foca nos participantes mais recentes do mercado — aqueles que compraram nas últimas
              semanas e meses.
            </p>
          </div>
          <div className="info-section">
            <h3>Como interpretar</h3>
            <p>
              Momentos que detentores de curto prazo estão com altos lucros podem indicar proximidade de
              um topo (muitas vezes local), enquanto momentos de altos prejuízos podem indicar proximidade
              de um fundo (muitas vezes local).
            </p>
            <p>
              Como o STH MVRV trabalha com detentores de curto prazo, ele é mais sensível e costuma
              responder mais rápido a mudanças no mercado. Sendo então às vezes melhor para encontrar
              topos e fundos locais, em vez de topos e fundos de ciclos (onde o MVRV "normal" costuma
              ser melhor).
            </p>
            <p>
              Durante bull markets, existe uma tendência que o preço do BTC encontre suporte no "Preço
              Realizado dos Detentores de Curto Prazo". Durante bear markets, muitas vezes esse preço
              realizado se torna resistência.
            </p>
            <p>
              Utilizar a banda de ± 1 desvio padrão também pode ser útil para buscar topos e fundos locais.
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
