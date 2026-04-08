import { useState, useEffect } from 'react';
import Layout  from '../../components/Layout';
import MVRVChart from '../../components/charts/MVRVChart';
import { BarChart2 } from 'lucide-react';

export default function MVRVPage() {
  const [mvrvData, setMvrvData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/mvrv')
      .then(r => r.json())
      .then(d => {
        setMvrvData(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <Layout title="MVRV" subtitle="Market Value to Realized Value · Avaliação on-chain do Bitcoin">
      <div className="page-layout">
        <div className="page-header">
          <div className="page-icon">
            <BarChart2 size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="page-title">MVRV</h1>
            <p className="page-sub">Market Value to Realized Value · Avaliação on-chain do Bitcoin</p>
          </div>
        </div>

        <div className="page-card">
          <MVRVChart mvrvData={mvrvData} loading={loading} error={error} />
        </div>

        <div className="info-panel">
          <div className="info-section">
            <h3>O que é</h3>
            <p>
              <strong>O MVRV (Market Value to Realized Value) é uma medida do lucro ou prejuízo
              não realizado dos detentores de BTC.</strong>
            </p>
            <p>
              Ele é obtido pela divisão do preço de mercado do Bitcoin pelo seu "Preço Realizado" —
              que é a média ponderada do preço pago por cada moeda, na última vez que foi movida na
              blockchain. O "Preço Realizado" pode ser entendido como um "custo médio global" dos
              detentores de BTC.
            </p>
            <p>
              <strong>Em essência, o MVRV mede o nível de lucro ou prejuízo médio dos participantes
              do mercado.</strong>
            </p>
            <p>
              Um MVRV de 2, por exemplo, indica que, na média, os participantes do mercado estão com
              um lucro de 2x (ou +100%). Enquanto um MVRV de 0,8 indica que, na média, os participantes
              do mercado estão com prejuízo de 20% (ou 0,8x o investido).
            </p>
          </div>
          <div className="info-section">
            <h3>Como interpretar</h3>
            <p>
              Um MVRV alto indica que investidores estão com lucros altos, o que pode ser um sinal de
              proximidade de um topo. Enquanto um MVRV baixo indica que investidores estão com poucos
              lucros (ou até com prejuízos), podendo indicar proximidade de um fundo.
            </p>
            <p>
              Os fundos de todos os ciclos do BTC aconteceram quando o MVRV foi abaixo de 1 — que indica
              que, na média, detentores de BTC estão no prejuízo. Historicamente, essas foram as melhores
              zonas para acumular BTC.
            </p>
            <p>
              Enquanto não é garantia que nos próximos ciclos o MVRV vai chegar a ir abaixo de 1, comprar
              na região em torno de 1 já é historicamente uma boa estratégia.
            </p>
            <p>
              Também é possível usar o MVRV para buscar regiões de topo de ciclos. Vale se atentar que
              existe uma tendência que o valor máximo alcançado pelo MVRV diminua ciclo após ciclo.
            </p>
            <p>
              Os topos dos primeiros ciclos do BTC aconteceram com o MVRV acima de 4. Já no ciclo que
              fez topo em 2021, o MVRV não chegou até 4. E no ciclo mais recente, que fez topo em 2025,
              o MVRV não chegou nem até 3.
            </p>
            <p>
              Esse tipo de comportamento é esperado conforme a capitalização de mercado do BTC aumenta,
              e o mercado amadurece.
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
