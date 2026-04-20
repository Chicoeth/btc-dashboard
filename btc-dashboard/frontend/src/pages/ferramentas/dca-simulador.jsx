import Head from 'next/head';
import { Calculator } from 'lucide-react';
import Layout from '../../components/Layout';
import DCASimulator from '../../components/charts/DCASimulator';

export default function DCASimuladorPage() {
  return (
    <Layout>
      <Head>
        <title>Simulador de DCA · Paradigma</title>
      </Head>

      <div className="page-layout">
        <div className="page-header">
          <div className="page-icon">
            <Calculator size={18} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="page-title">Simulador de DCA</h1>
            <p className="page-sub">
              Dollar Cost Average · Simule aportes recorrentes com condições opcionais
            </p>
          </div>
        </div>

        <div className="page-card">
          <DCASimulator />
        </div>

        <div className="info-panel">
          <div className="info-section card">
            <h3>O que é</h3>
            <p>
              <strong>DCA (Dollar Cost Average)</strong> é uma estratégia de investimento em que
              aportes de valor fixo são feitos em intervalos regulares, independentemente do
              preço do ativo. O objetivo é reduzir o impacto da volatilidade ao longo do tempo,
              comprando mais unidades quando o preço está baixo e menos quando está alto.
            </p>
            <p>
              Este simulador reproduz uma estratégia de DCA usando dados históricos reais do
              Bitcoin. Basta definir a frequência, o valor e o período dos aportes para ver
              quantos BTC você teria acumulado, o preço médio de compra e o lucro atual.
            </p>
          </div>

          <div className="info-section card">
            <h3>Indicador condicional</h3>
            <p>
              O campo opcional de indicador transforma o DCA em uma estratégia condicional:
              os aportes só acontecem quando o indicador escolhido estiver <strong>abaixo</strong>{' '}
              do valor definido. Isso permite testar ideias como "só comprar quando o mercado
              estiver em medo" ou "só comprar quando o MVRV estiver em zona de acumulação".
            </p>
            <p>
              Quando a condição não é cumprida em uma data programada, o aporte simplesmente
              não acontece — o card "Aportes realizados" mostra quantos dos aportes programados
              foram de fato executados.
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
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .page-icon {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          background: rgba(247,147,26,0.1);
          border: 1px solid rgba(247,147,26,0.2);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--brand-orange);
        }
        .page-title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0;
        }
        .page-sub {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          margin: 2px 0 0 0;
          letter-spacing: 0.02em;
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
        .info-section {
          padding: 20px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
        }
        .info-section h3 {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-primary);
          margin: 0 0 12px 0;
        }
        .info-section p {
          font-family: var(--font-body);
          font-size: 13px;
          line-height: 1.7;
          color: var(--text-muted);
          margin: 0 0 10px 0;
        }
        .info-section p:last-child { margin-bottom: 0; }
        .info-section strong {
          color: var(--text-secondary);
        }

        @media (max-width: 900px) {
          .info-panel { grid-template-columns: 1fr; }
        }
      `}</style>
    </Layout>
  );
}
