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
          <h3>O que é o STH MVRV?</h3>
          <p>
            O <strong>STH MVRV</strong> (Short-Term Holder Market Value to Realized Value) compara o preço
            de mercado do Bitcoin com o <em>preço realizado dos detentores de curto prazo</em> — ou seja,
            o custo médio de aquisição das moedas movidas nos últimos 155 dias.
          </p>
          <p>
            Enquanto o MVRV tradicional mede todos os detentores, o STH MVRV foca nos participantes mais
            recentes do mercado — os que compraram nas últimas semanas e meses.
          </p>
        </div>
        <div className="info-section">
          <h3>Como interpretar</h3>
          <div className="zone-rows">
            <div className="zone-row">
              <span className="dot" style={{background:'#e8000a'}} />
              <div>
                <strong style={{color:'#e8000a'}}>STH MVRV {'>'} 2.0</strong>
                <p>Detentores recentes com lucro extremo. Historicamente precede topos locais e correções.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{background:'#f5c400'}} />
              <div>
                <strong style={{color:'#f5c400'}}>STH MVRV 1.0 – 2.0</strong>
                <p>Lucro moderado. Mercado saudável com pressão de venda controlável.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{background:'#80c440'}} />
              <div>
                <strong style={{color:'#80c440'}}>STH MVRV 0.8 – 1.0</strong>
                <p>Detentores recentes perto do custo ou com leve prejuízo. Zona de possível acumulação.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{background:'#00c44f'}} />
              <div>
                <strong style={{color:'#00c44f'}}>STH MVRV {'<'} 0.8</strong>
                <p>Capitulação dos compradores recentes. Oportunidade histórica de compra — fundos de ciclo.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="info-section">
          <h3>Diferença para o MVRV geral</h3>
          <p>
            O MVRV geral inclui moedas que não se movem há anos (detentores de longo prazo),
            diluindo o sinal. O STH MVRV é mais sensível e reage mais rápido às mudanças de sentimento,
            sendo especialmente útil para identificar topos e fundos locais dentro de um ciclo.
          </p>
          <p>
            Quando o STH MVRV cruza abaixo de 1.0, significa que os compradores recentes estão no prejuízo
            — momento em que historicamente o "dinheiro inteligente" começa a acumular.
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
          border-radius: 8px;
          overflow: hidden;
        }
        .info-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }
        .info-section {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 20px;
        }
        .info-section h3 {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 0 0 12px;
        }
        .info-section p {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.7;
          margin: 0 0 8px;
        }
        .info-section strong { color: var(--text-secondary); }
        .info-section em { color: var(--text-secondary); font-style: normal; }
        .zone-rows { display: flex; flex-direction: column; gap: 12px; }
        .zone-row { display: flex; gap: 10px; align-items: flex-start; }
        .dot {
          width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 3px;
        }
        .zone-row p {
          font-size: 12px; color: var(--text-muted); line-height: 1.6; margin: 2px 0 0;
        }
      `}</style>
      </div>
    </Layout>
  );
}
