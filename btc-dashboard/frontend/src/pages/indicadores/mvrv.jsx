import { useState, useEffect } from 'react';
import Layout  from '../../components/Layout';
import MVRVChart from '../../components/charts/MVRVChart';

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
      <div className="page-card">
        <MVRVChart mvrvData={mvrvData} loading={loading} error={error} />
      </div>
      <div className="info-panel">
        <div className="info-section">
          <h3>O que é o MVRV?</h3>
          <p>
            O <strong>MVRV</strong> (Market Value to Realized Value) compara o preço de mercado do Bitcoin
            com o seu <em>preço realizado</em> — a média ponderada do preço pago por cada moeda na última
            vez que foi movida na blockchain.
          </p>
          <p>
            Em essência, mede se os detentores de Bitcoin estão, em média, no lucro ou no prejuízo.
          </p>
        </div>
        <div className="info-section">
          <h3>Como interpretar</h3>
          <div className="zone-rows">
            <div className="zone-row">
              <span className="dot" style={{background:'#e8000a'}} />
              <div>
                <strong style={{color:'#e8000a'}}>MVRV {'>'} 3.5</strong>
                <p>Mercado fortemente sobrevalorizado. Historicamente próximo de topos de ciclo — alta probabilidade de correção.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{background:'#f5c400'}} />
              <div>
                <strong style={{color:'#f5c400'}}>MVRV 2.5 – 3.5</strong>
                <p>Zona de atenção. Lucros elevados podem incentivar vendas e pressão baixista.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{background:'#80c440'}} />
              <div>
                <strong style={{color:'#80c440'}}>MVRV 1.0 – 2.5</strong>
                <p>Zona neutra a moderadamente otimista. Mercado saudável, com potencial de alta.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{background:'#00c44f'}} />
              <div>
                <strong style={{color:'#00c44f'}}>MVRV {'<'} 1.0</strong>
                <p>Preço abaixo do custo médio histórico. Zonas como esta marcaram fundos de ciclo — oportunidade histórica de compra.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .page-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 20px;
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
        .zone-rows { display: flex; flex-direction: column; gap: 14px; }
        .zone-row { display: flex; gap: 12px; align-items: flex-start; }
        .zone-row .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
        .zone-row div p { font-size: 12px; color: var(--text-muted); margin: 3px 0 0; line-height: 1.5; }
        .zone-row strong { font-size: 13px; }
      `}</style>
    </Layout>
  );
}
