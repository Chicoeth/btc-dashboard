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
            <h3>O que é</h3>
            <p>
              O Múltiplo de Mayer é simplesmente o preço atual do Bitcoin dividido pela sua média móvel
              de 200 dias (200DMA) — que é amplamente utilizada para tentar diferenciar fases de alta
              e de baixa.
            </p>
            <p>
              <strong>É uma forma rápida de avaliar se o preço está "esticado" demais em relação à
              tendência de longo prazo</strong> — apontando sobrevalorização ou subvalorização.
            </p>
          </div>
          <div className="info-section">
            <h3>Como interpretar</h3>
            <p>
              Valores altos do Múltiplo de Mayer indicam que o preço está se esticando demais acima de
              sua média de longo prazo, sugerindo supervalorização. Valores baixos (menores que 1) também
              indicam que o preço está se esticando demais, mas dessa vez abaixo da média — indicando
              subvalorização.
            </p>
            <p>
              É importante se atentar que o Múltiplo de Mayer costuma ficar acima de 1 durante boa parte
              de seus ciclos de alta; e abaixo de 1 durante boa parte do seu ciclo de baixa.
            </p>
            <p>
              Então, por exemplo, o Múltiplo de Mayer pode já ir abaixo de 1 durante o início de uma
              tendência de baixa, onde o preço ainda vai cair por mais um tempo considerável. Assim como
              pode já estar acima de 1, mas ser apenas o início da fase de alta.
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
