import { useState, useEffect } from 'react';
import Layout     from '../../components/Layout';
import MayerChart from '../../components/charts/MayerChart';
import { Divide } from 'lucide-react';

export default function MayerPage() {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading]    = useState(true);
  const [error, setError]        = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/price')
      .then(r => r.json())
      .then(d => {
        setPriceData(d?.data ?? (Array.isArray(d) ? d : []));
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <Layout title="Múltiplo de Mayer" subtitle="Preço ÷ SMA 200 · Avaliação relativa à média de longo prazo">
      <div className="page-layout">
        <div className="page-header">
          <div className="page-icon">
            <Divide size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="page-title">Múltiplo de Mayer</h1>
            <p className="page-sub">Preço ÷ SMA 200 · Avaliação relativa à média de longo prazo</p>
          </div>
        </div>

        <div className="page-card">
        <MayerChart priceData={priceData} loading={loading} error={error} />
      </div>
      <div className="info-panel">
        <div className="info-section">
          <h3>O que é o Múltiplo de Mayer?</h3>
          <p>
            Criado por Trace Mayer, o <strong>Múltiplo de Mayer</strong> é simplesmente o preço
            atual do Bitcoin dividido pela sua <em>média móvel de 200 dias</em> (SMA 200).
          </p>
          <p>
            É uma forma rápida de avaliar se o preço está "esticado" demais acima da tendência
            de longo prazo — ou se está descontado em relação a ela.
          </p>
        </div>
        <div className="info-section">
          <h3>Como interpretar</h3>
          <div className="zone-rows">
            <div className="zone-row">
              <span className="dot" style={{ background: '#e8000a' }} />
              <div>
                <strong style={{ color: '#e8000a' }}>Mayer {'>'} 2.4</strong>
                <p>Sobrecompra extrema. Historicamente, apenas ~5% dos dias ficaram acima deste nível — zona de euforia.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{ background: '#f5a000' }} />
              <div>
                <strong style={{ color: '#f5a000' }}>Mayer 1.5 – 2.4</strong>
                <p>Preço bem acima da média. O mercado está aquecido — atenção redobrada para sinais de reversão.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{ background: '#8cb400' }} />
              <div>
                <strong style={{ color: '#8cb400' }}>Mayer 1.0 – 1.5</strong>
                <p>Zona neutra a moderadamente otimista. Preço próximo ou acima da tendência — mercado saudável.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{ background: '#00c44f' }} />
              <div>
                <strong style={{ color: '#00c44f' }}>Mayer {'<'} 1.0</strong>
                <p>Preço abaixo da SMA 200 — historicamente, zonas de acumulação. Quanto mais baixo, maior o desconto.</p>
              </div>
            </div>
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
