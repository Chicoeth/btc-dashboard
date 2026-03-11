import Layout from '../components/Layout';
import {
  TrendingUp, Activity, Pickaxe, BarChart2,
  Wallet, Globe, Layers, ArrowRight, Bitcoin,
  Zap, Database, RefreshCw
} from 'lucide-react';

const categories = [
  {
    icon: TrendingUp,
    title: 'Preço & Mercado',
    description: 'Histórico de preço, volume, market cap e dominância do Bitcoin.',
    metrics: ['Preço BTC/USD', 'Volume 24h', 'Market Cap', 'Dominância'],
    color: '#3b82f6',
    count: 4,
  },
  {
    icon: Activity,
    title: 'On-Chain',
    description: 'Atividade na blockchain: transações, endereços e UTXOs.',
    metrics: ['Transações/dia', 'Endereços ativos', 'UTXO Set', 'Lightning'],
    color: '#22c55e',
    count: 4,
  },
  {
    icon: Pickaxe,
    title: 'Mineração',
    description: 'Hashrate, dificuldade, receita e distribuição de pools.',
    metrics: ['Hashrate', 'Dificuldade', 'Receita', 'Pools'],
    color: '#f59e0b',
    count: 4,
  },
  {
    icon: BarChart2,
    title: 'Indicadores',
    description: 'MVRV, Stock-to-Flow, NVT e outros modelos de avaliação.',
    metrics: ['MVRV Z-Score', 'Stock-to-Flow', 'NVT Ratio', 'Puell Multiple'],
    color: '#a855f7',
    count: 5,
  },
  {
    icon: Wallet,
    title: 'Holders',
    description: 'Distribuição de moedas, comportamento e fluxos em exchanges.',
    metrics: ['Distribuição', 'HODLers vs Traders', 'Exchanges', ''],
    color: '#ec4899',
    count: 3,
  },
  {
    icon: Globe,
    title: 'Rede',
    description: 'Nós da rede, mempool e mercado de taxas.',
    metrics: ['Nós ativos', 'Mempool', 'Fee Market', ''],
    color: '#06b6d4',
    count: 3,
  },
  {
    icon: Layers,
    title: 'Ciclos',
    description: 'Halvings, ciclos de bull/bear e comparativos históricos.',
    metrics: ['Halvings', 'Bull/Bear', 'Comparativos', ''],
    color: '#f7931a',
    count: 3,
  },
];

const stats = [
  { label: 'Indicadores planejados', value: '26+', icon: BarChart2, color: '#f7931a' },
  { label: 'Atualização', value: 'Diária', icon: RefreshCw, color: '#22c55e' },
  { label: 'Fontes de dados', value: '8+', icon: Database, color: '#3b82f6' },
  { label: 'Categorias', value: '7', icon: Layers, color: '#a855f7' },
];

export default function HomePage() {
  return (
    <Layout>
      <div className="home">
        {/* Header */}
        <div className="home-header">
          <div className="header-badge">
            <Bitcoin size={11} />
            <span>Bitcoin Analytics</span>
          </div>
          <h1 className="home-title">
            Dashboard de Métricas
            <br />
            <span className="title-accent">do Bitcoin</span>
          </h1>
          <p className="home-subtitle">
            Visualização abrangente de dados on-chain, métricas de mercado e indicadores
            fundamentais para análise do Bitcoin. Dados históricos completos, atualizados diariamente.
          </p>
        </div>

        {/* Stats row */}
        <div className="stats-row">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="stat-card card">
                <div className="stat-icon" style={{ color: stat.color, background: `${stat.color}15` }}>
                  <Icon size={16} strokeWidth={1.5} />
                </div>
                <div className="stat-info">
                  <span className="stat-value" style={{ color: stat.color }}>{stat.value}</span>
                  <span className="stat-label">{stat.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section title */}
        <div className="section-header">
          <h2 className="section-title">Categorias de Indicadores</h2>
          <p className="section-desc">
            Selecione uma categoria no menu lateral para explorar os gráficos disponíveis.
          </p>
        </div>

        {/* Category grid */}
        <div className="category-grid">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.title} className="category-card card">
                <div className="category-card-header">
                  <div
                    className="category-icon"
                    style={{
                      color: cat.color,
                      background: `${cat.color}12`,
                      borderColor: `${cat.color}25`,
                    }}
                  >
                    <Icon size={18} strokeWidth={1.5} />
                  </div>
                  <div className="category-count-badge" style={{ color: cat.color, background: `${cat.color}12` }}>
                    {cat.count} métricas
                  </div>
                </div>

                <h3 className="category-title">{cat.title}</h3>
                <p className="category-description">{cat.description}</p>

                <div className="category-metrics">
                  {cat.metrics.filter(Boolean).map((m) => (
                    <span key={m} className="metric-tag">{m}</span>
                  ))}
                </div>

                <div className="category-footer">
                  <span className="coming-soon-label">
                    Em desenvolvimento
                  </span>
                  <ArrowRight size={13} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Info banner */}
        <div className="info-banner card">
          <div className="info-banner-icon">
            <Zap size={16} strokeWidth={1.5} />
          </div>
          <div className="info-banner-content">
            <strong>Arquitetura de dados eficiente:</strong> Todos os dados históricos são baixados
            uma única vez e armazenados localmente. As atualizações diárias fazem apenas um
            request incremental por fonte, mantendo os gráficos sempre atualizados com mínimo
            de requisições às APIs externas.
          </div>
        </div>
      </div>

      <style jsx>{`
        .home {
          max-width: 1100px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        /* Header */
        .home-header {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .header-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--brand-orange);
          background: rgba(247, 147, 26, 0.08);
          border: 1px solid rgba(247, 147, 26, 0.2);
          padding: 4px 10px;
          border-radius: 4px;
          width: fit-content;
        }

        .home-title {
          font-family: var(--font-display);
          font-size: clamp(32px, 4vw, 48px);
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .title-accent {
          color: var(--brand-orange);
        }

        .home-subtitle {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.7;
          max-width: 620px;
        }

        /* Stats */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
        }

        .stat-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-value {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          line-height: 1;
        }

        .stat-label {
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.02em;
        }

        /* Section header */
        .section-header {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .section-desc {
          font-size: 13px;
          color: var(--text-muted);
        }

        /* Category Grid */
        .category-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .category-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          cursor: default;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .category-card:hover {
          transform: translateY(-2px);
        }

        .category-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .category-icon {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .category-count-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .category-title {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .category-description {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.6;
        }

        .category-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .metric-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          padding: 2px 8px;
          border-radius: 3px;
          letter-spacing: 0.02em;
        }

        .category-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 8px;
          border-top: 1px solid var(--border-subtle);
          color: var(--text-muted);
        }

        .coming-soon-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        /* Info Banner */
        .info-banner {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 16px 20px;
          border-color: rgba(247, 147, 26, 0.15);
          background: rgba(247, 147, 26, 0.04);
        }

        .info-banner-icon {
          color: var(--brand-orange);
          padding-top: 1px;
          flex-shrink: 0;
        }

        .info-banner-content {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .info-banner-content strong {
          color: var(--text-primary);
          font-weight: 500;
        }

        @media (max-width: 900px) {
          .category-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .stats-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .category-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Layout>
  );
}
