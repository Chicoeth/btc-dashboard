import { useState, useEffect } from 'react';
import Layout   from '../../components/Layout';
import ETFChart from '../../components/charts/ETFChart';
import { Landmark } from 'lucide-react';

export default function ETFPage() {
  const [etfData, setEtfData]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/etf-holdings')
      .then(r => r.json())
      .then(data => {
        setEtfData(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <Layout title="ETFs de Bitcoin" subtitle="Holdings dos ETFs Spot de Bitcoin dos EUA">
      <div className="page-layout">
        <div className="page-header">
          <div className="page-icon">
            <Landmark size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="page-title">ETFs de Bitcoin</h1>
            <p className="page-sub">Holdings dos ETFs Spot de Bitcoin dos EUA · 11 fundos aprovados pela SEC</p>
          </div>
        </div>

        <div className="page-card">
        <ETFChart
          etfData={etfData}
          loading={loading}
          error={error}
        />
      </div>
      <div className="info-panel">
        <div className="info-section">
          <h3>O que é este gráfico?</h3>
          <p>
            Mostra os holdings combinados dos <strong>11 ETFs Spot de Bitcoin</strong> listados nos EUA,
            aprovados pela SEC em janeiro de 2024. Juntos, eles detêm mais de 1.3 milhão de BTC (~6% de todo o supply).
          </p>
          <p>
            A <strong>linha laranja</strong> é o preço de mercado do Bitcoin. As <strong>barras</strong> mostram
            a quantidade total de BTC sob custódia dos ETFs.
          </p>
        </div>
        <div className="info-section">
          <h3>ETFs incluídos</h3>
          <div className="zone-rows">
            <div className="zone-row">
              <span className="dot" style={{background:'#f7931a'}} />
              <div>
                <strong style={{color:'#f7931a'}}>IBIT (BlackRock)</strong>
                <p>O maior ETF de Bitcoin do mundo, com ~60% de todo o mercado de ETFs spot.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{background:'#3b82f6'}} />
              <div>
                <strong style={{color:'#3b82f6'}}>FBTC (Fidelity)</strong>
                <p>Segundo maior, com custódia própria via Fidelity Digital Assets.</p>
              </div>
            </div>
            <div className="zone-row">
              <span className="dot" style={{background:'#6366f1'}} />
              <div>
                <strong style={{color:'#6366f1'}}>GBTC (Grayscale)</strong>
                <p>Convertido de trust para ETF em jan/2024. Ainda detém holdings significativos.</p>
              </div>
            </div>
          </div>
          <p style={{marginTop: '8px', color: '#5a5a80', fontSize: '12px'}}>
            Outros: BITB (Bitwise), ARKB (ARK/21Shares), HODL (VanEck), BTCO (Invesco),
            EZBC (Franklin), BRRR (CoinShares), BTCW (WisdomTree), BTC (Grayscale Mini).
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
