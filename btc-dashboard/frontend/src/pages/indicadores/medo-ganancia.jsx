/**
 * pages/indicadores/medo-ganancia.jsx
 * Índice do Medo & Ganância
 */

import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import FearGreedChart from '../../components/charts/FearGreedChart';
import { Activity } from 'lucide-react';

function useFngData() {
  const [fngData,   setFngData]   = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [fRes, pRes] = await Promise.all([
          fetch('/api/fng'),
          fetch('/api/price'),
        ]);
        if (!fRes.ok) throw new Error(await fRes.text());
        if (!pRes.ok) throw new Error(await pRes.text());
        const [fng, priceResp] = await Promise.all([fRes.json(), pRes.json()]);
        setFngData(Array.isArray(fng) ? fng : []);
        setPriceData(Array.isArray(priceResp) ? priceResp : (priceResp?.data ?? []));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { fngData, priceData, loading, error };
}

export default function MedoGananciaPage() {
  const { fngData, priceData, loading, error } = useFngData();

  return (
    <Layout>
      <div className="page-layout">

        {/* Page title */}
        <div className="page-header">
          <div className="page-icon">
            <Activity size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="page-title">Índice do Medo &amp; Ganância</h1>
            <p className="page-sub">Sentimento do mercado de Bitcoin · 0 = Medo Extremo · 100 = Ganância Extrema</p>
          </div>
        </div>

        {/* Chart card */}
        <div className="page-card">
          <FearGreedChart
            priceData={priceData}
            fngData={fngData}
            loading={loading}
            error={error}
          />
        </div>

        {/* Info panels below chart */}
        <div className="info-panel">
          <div className="info-section card">
            <h3>O que é</h3>
            <p>
              O Índice do Medo e Ganância (Fear &amp; Greed Index) é um indicador
              composto que tenta medir o sentimento predominante dos participantes
              do mercado de Bitcoin em uma escala de 0 a 100.
            </p>
            <p>
              O índice foi criado pela <strong>alternative.me</strong> e é calculado
              diariamente com base em seis fatores ponderados:
            </p>
            <ul>
              <li><span className="tag">25%</span> Volatilidade do preço vs. médias históricas</li>
              <li><span className="tag">25%</span> Momentum e volume de negociação</li>
              <li><span className="tag">15%</span> Redes sociais — volume e sentimento</li>
              <li><span className="tag">10%</span> Pesquisas de opinião periódicas</li>
              <li><span className="tag">10%</span> Dominância do Bitcoin no mercado cripto</li>
              <li><span className="tag">15%</span> Tendências de busca no Google Trends</li>
            </ul>
            <div className="scale-legend">
              {[
                { range: '0–24',  label: 'Medo Extremo',    color: '#e8000a' },
                { range: '25–44', label: 'Medo',            color: '#f07000' },
                { range: '45–55', label: 'Neutro',          color: '#f5c400' },
                { range: '56–74', label: 'Ganância',        color: '#80c400' },
                { range: '75–100',label: 'Ganância Extrema',color: '#00c44f' },
              ].map(({ range, label, color }) => (
                <div key={range} className="scale-row">
                  <span className="scale-dot" style={{ background: color }} />
                  <span className="scale-range" style={{ color }}>{range}</span>
                  <span className="scale-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="info-section card">
            <h3>Como Usar</h3>
            <p>
              O índice funciona como um sinal contrário de sentimento: os extremos
              costumam marcar pontos de inflexão no preço.
            </p>
            <div className="tip-block tip-buy">
              <div className="tip-title">📉 Medo Extremo (0–24)</div>
              <p>
                O mercado está em pânico. Historicamente, esses períodos
                correspondem a zonas de acumulação favoráveis para investidores
                com visão de longo prazo.
              </p>
            </div>
            <div className="tip-block tip-sell">
              <div className="tip-title">📈 Ganância Extrema (75–100)</div>
              <p>
                O mercado está eufórico. Períodos prolongados de ganância extrema
                frequentemente precedem correções. É um sinal de cautela, não
                necessariamente de venda imediata.
              </p>
            </div>
            <p className="caveat">
              ⚠ O índice mede sentimento, não fundamentos. Use-o como
              complemento a outros indicadores — nunca como sinal isolado de
              entrada ou saída.
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

        /* Info panels — 2 columns below chart */
        .info-panel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .info-section {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .info-section h3 {
          font-family: var(--font-display); font-size: 13px; font-weight: 600;
          color: var(--text-secondary); text-transform: uppercase;
          letter-spacing: 0.08em; margin: 0 0 4px;
        }
        .info-section p {
          font-size: 13px; color: var(--text-muted); line-height: 1.7; margin: 0;
        }
        .info-section strong { color: var(--text-secondary); font-weight: 600; }

        .info-section ul {
          list-style: none; display: flex; flex-direction: column; gap: 5px;
          padding: 0; margin: 0;
        }
        .info-section ul li {
          font-size: 11px; color: var(--text-secondary);
          display: flex; align-items: center; gap: 7px; line-height: 1.4;
        }
        .tag {
          font-family: var(--font-mono); font-size: 9px; font-weight: 600;
          background: rgba(247,147,26,0.1); color: var(--brand-orange);
          padding: 1px 5px; border-radius: 3px; flex-shrink: 0;
        }

        .scale-legend {
          background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle);
          border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;
        }
        .scale-row { display: flex; align-items: center; gap: 8px; }
        .scale-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .scale-range {
          font-family: var(--font-mono); font-size: 10px; font-weight: 600;
          min-width: 36px;
        }
        .scale-label { font-size: 11px; color: var(--text-secondary); }

        .tip-block {
          border-radius: 6px; padding: 10px 12px;
          display: flex; flex-direction: column; gap: 5px;
        }
        .tip-buy  { background: rgba(232,0,10,0.06);  border: 1px solid rgba(232,0,10,0.15);  }
        .tip-sell { background: rgba(0,196,79,0.06);  border: 1px solid rgba(0,196,79,0.15);  }

        .tip-title { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--text-primary); }
        .tip-block p {
          font-size: 11px; color: var(--text-secondary);
          line-height: 1.55; margin: 0;
        }

        .caveat {
          font-family: var(--font-mono) !important; font-size: 10px !important;
          color: var(--text-muted) !important; line-height: 1.5 !important;
          background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle);
          border-radius: 5px; padding: 8px 10px;
        }

        @media (max-width: 900px) {
          .info-panel { grid-template-columns: 1fr; }
        }
      `}</style>
    </Layout>
  );
}
