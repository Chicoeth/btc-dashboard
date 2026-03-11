import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  BarChart2,
  Layers,
  ChevronDown,
  ChevronRight,
  Zap,
  Globe,
  Users,
  Bitcoin,
  Pickaxe,
  Wallet,
  ArrowLeftRight,
} from 'lucide-react';

const navStructure = [
  {
    label: 'Visão Geral',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    label: 'Preço & Mercado',
    icon: TrendingUp,
    children: [
      { label: 'Preço Histórico', href: '/mercado/preco' },
      { label: 'Volume de Negociação', href: '/mercado/volume', soon: true },
      { label: 'Dominância BTC', href: '/mercado/dominancia', soon: true },
      { label: 'Capitalização', href: '/mercado/market-cap', soon: true },
    ],
  },
  {
    label: 'On-Chain',
    icon: Activity,
    children: [
      { label: 'Transações', href: '/onchain/transacoes', soon: true },
      { label: 'Endereços Ativos', href: '/onchain/enderecos', soon: true },
      { label: 'UTXO Set', href: '/onchain/utxo', soon: true },
      { label: 'Lightning Network', href: '/onchain/lightning', soon: true },
    ],
  },
  {
    label: 'Mineração',
    icon: Pickaxe,
    children: [
      { label: 'Hashrate', href: '/mineracao/hashrate', soon: true },
      { label: 'Dificuldade', href: '/mineracao/dificuldade', soon: true },
      { label: 'Receita dos Mineradores', href: '/mineracao/receita', soon: true },
      { label: 'Pools', href: '/mineracao/pools', soon: true },
    ],
  },
  {
    label: 'Indicadores',
    icon: BarChart2,
    children: [
      { label: 'MVRV Z-Score', href: '/indicadores/mvrv', soon: true },
      { label: 'Stock-to-Flow', href: '/indicadores/s2f', soon: true },
      { label: 'NVT Ratio', href: '/indicadores/nvt', soon: true },
      { label: 'Realized Price', href: '/indicadores/realized-price', soon: true },
      { label: 'Puell Multiple', href: '/indicadores/puell', soon: true },
    ],
  },
  {
    label: 'Holders',
    icon: Wallet,
    children: [
      { label: 'Distribuição', href: '/holders/distribuicao', soon: true },
      { label: 'HODLers vs Traders', href: '/holders/comportamento', soon: true },
      { label: 'Exchanges', href: '/holders/exchanges', soon: true },
    ],
  },
  {
    label: 'Rede',
    icon: Globe,
    children: [
      { label: 'Nós da Rede', href: '/rede/nos', soon: true },
      { label: 'Mempool', href: '/rede/mempool', soon: true },
      { label: 'Fee Market', href: '/rede/fees', soon: true },
    ],
  },
  {
    label: 'Ciclos',
    icon: Layers,
    children: [
      { label: 'Halvings', href: '/ciclos/halvings', soon: true },
      { label: 'Bull/Bear Markets', href: '/ciclos/mercados', soon: true },
      { label: 'Comparativo de Ciclos', href: '/ciclos/comparativo', soon: true },
    ],
  },
];

function NavItem({ item, depth = 0 }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;

  const isActive = item.href && router.pathname === item.href;
  const isChildActive = hasChildren && item.children.some(c => router.pathname === c.href);

  return (
    <div className="nav-item-wrapper">
      {hasChildren ? (
        <button
          onClick={() => setOpen(!open)}
          className={`nav-item group ${isChildActive ? 'nav-item--child-active' : ''}`}
          style={{ paddingLeft: depth > 0 ? `${depth * 16 + 16}px` : undefined }}
        >
          {Icon && (
            <span className="nav-icon">
              <Icon size={15} strokeWidth={1.5} />
            </span>
          )}
          <span className="nav-label">{item.label}</span>
          <span className={`nav-chevron ${open ? 'nav-chevron--open' : ''}`}>
            <ChevronRight size={13} strokeWidth={1.5} />
          </span>
        </button>
      ) : (
        <Link
          href={item.href || '#'}
          className={`nav-item ${isActive ? 'nav-item--active' : ''} ${item.soon ? 'nav-item--soon' : ''}`}
          style={{ paddingLeft: depth > 0 ? `${depth * 16 + 28}px` : undefined }}
        >
          {Icon && (
            <span className="nav-icon">
              <Icon size={15} strokeWidth={1.5} />
            </span>
          )}
          <span className="nav-label">{item.label}</span>
          {item.soon && <span className="soon-badge">em breve</span>}
        </Link>
      )}

      {hasChildren && open && (
        <div className="nav-children">
          {item.children.map((child) => (
            <NavItem key={child.label} item={child} depth={depth + 1} />
          ))}
        </div>
      )}

      <style jsx>{`
        .nav-item-wrapper {
          display: flex;
          flex-direction: column;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 400;
          color: var(--text-secondary);
          text-decoration: none;
          border: none;
          background: none;
          width: 100%;
          cursor: pointer;
          text-align: left;
          border-radius: 0;
          transition: color 0.15s ease, background 0.15s ease;
          position: relative;
          font-family: var(--font-body);
          letter-spacing: 0.01em;
        }

        .nav-item:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.03);
        }

        .nav-item--active {
          color: var(--brand-orange) !important;
          background: rgba(247, 147, 26, 0.06) !important;
        }

        .nav-item--active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--brand-orange);
          border-radius: 0 2px 2px 0;
        }

        .nav-item--child-active .nav-label {
          color: var(--text-primary);
        }

        .nav-item--soon {
          opacity: 0.5;
          pointer-events: none;
        }

        .nav-icon {
          display: flex;
          align-items: center;
          opacity: 0.7;
          flex-shrink: 0;
        }

        .nav-item--active .nav-icon,
        .nav-item:hover .nav-icon {
          opacity: 1;
        }

        .nav-label {
          flex: 1;
          font-size: 13px;
        }

        .nav-chevron {
          display: flex;
          align-items: center;
          transition: transform 0.2s ease;
          opacity: 0.4;
        }

        .nav-chevron--open {
          transform: rotate(90deg);
        }

        .soon-badge {
          font-size: 9px;
          font-family: var(--font-mono);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: rgba(247, 147, 26, 0.1);
          color: var(--brand-orange);
          padding: 1px 5px;
          border-radius: 3px;
          opacity: 0.7;
        }

        .nav-children {
          overflow: hidden;
          animation: expandDown 0.2s ease forwards;
        }

        @keyframes expandDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Bitcoin size={18} strokeWidth={2} />
        </div>
        <div className="logo-text">
          <span className="logo-title">BTC</span>
          <span className="logo-subtitle">Metrics</span>
        </div>

        <style jsx>{`
          .sidebar-logo {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 20px 16px 18px;
            border-bottom: 1px solid var(--border-subtle);
            margin-bottom: 8px;
          }

          .logo-icon {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--brand-orange), #e67e0a);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
            box-shadow: 0 0 16px rgba(247, 147, 26, 0.3);
          }

          .logo-text {
            display: flex;
            flex-direction: column;
            line-height: 1;
          }

          .logo-title {
            font-family: var(--font-display);
            font-size: 16px;
            font-weight: 800;
            color: var(--text-primary);
            letter-spacing: 0.08em;
          }

          .logo-subtitle {
            font-family: var(--font-mono);
            font-size: 9px;
            color: var(--text-muted);
            letter-spacing: 0.12em;
            text-transform: uppercase;
            margin-top: 1px;
          }
        `}</style>
      </div>

      {/* Section label */}
      <div className="nav-section-label">
        NAVEGAÇÃO
        <style jsx>{`
          .nav-section-label {
            font-family: var(--font-mono);
            font-size: 9px;
            letter-spacing: 0.1em;
            color: var(--text-muted);
            padding: 8px 16px 6px;
            text-transform: uppercase;
          }
        `}</style>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navStructure.map((item) => (
          <NavItem key={item.label} item={item} />
        ))}

        <style jsx>{`
          .sidebar-nav {
            flex: 1;
            overflow-y: auto;
            padding-bottom: 16px;
          }
        `}</style>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="footer-meta">
          <span className="footer-update">Dados atualizados diariamente</span>
          <span className="footer-dot">·</span>
          <span className="footer-source">Múltiplas fontes</span>
        </div>

        <style jsx>{`
          .sidebar-footer {
            padding: 12px 16px;
            border-top: 1px solid var(--border-subtle);
          }

          .footer-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
          }

          .footer-update,
          .footer-source,
          .footer-dot {
            font-family: var(--font-mono);
            font-size: 9px;
            color: var(--text-muted);
            letter-spacing: 0.03em;
          }
        `}</style>
      </div>
    </aside>
  );
}
