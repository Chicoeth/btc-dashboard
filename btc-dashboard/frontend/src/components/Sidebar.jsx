import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bitcoin, TrendingUp, Activity, BarChart2, Divide, GitCompareArrows, Users } from 'lucide-react';

const NAV = [
  { label: 'Preço Histórico',        href: '/mercado/preco',                icon: TrendingUp       },
  { label: 'MVRV',                   href: '/indicadores/mvrv',             icon: BarChart2         },
  { label: 'STH MVRV',               href: '/indicadores/sth-mvrv',         icon: Users             },
  { label: 'Múltiplo de Mayer',      href: '/indicadores/multiplo-mayer',   icon: Divide            },
  { label: 'Índice Medo & Ganância', href: '/indicadores/medo-ganancia',    icon: Activity          },
  { label: 'Comparador de Ciclos',   href: '/indicadores/comparador-ciclos', icon: GitCompareArrows },
];

export default function Sidebar() {
  const router = useRouter();

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon"><Bitcoin size={18} strokeWidth={2} /></div>
        <div className="logo-text">
          <span className="logo-title">BTC</span>
          <span className="logo-subtitle">Metrics</span>
        </div>
      </div>

      <div className="nav-section-label">INDICADORES</div>

      <nav className="sidebar-nav">
        {NAV.map(({ label, href, icon: Icon, soon }) => {
          const active = router.pathname === href;
          return (
            <Link
              key={href}
              href={soon ? '#' : href}
              className={`nav-item ${active ? 'nav-item--active' : ''} ${soon ? 'nav-item--soon' : ''}`}
            >
              <span className="nav-icon"><Icon size={15} strokeWidth={1.5} /></span>
              <span className="nav-label">{label}</span>
              {soon && <span className="soon-badge">em breve</span>}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span>Dados atualizados diariamente</span>
      </div>

      <style jsx>{`
        .logo {
          display:flex; align-items:center; gap:10px;
          padding:20px 16px 18px; border-bottom:1px solid var(--border-subtle); margin-bottom:8px;
        }
        .logo-icon {
          width:32px; height:32px; flex-shrink:0;
          background:linear-gradient(135deg,var(--brand-orange),#e67e0a);
          border-radius:8px; display:flex; align-items:center; justify-content:center;
          color:white; box-shadow:0 0 16px rgba(247,147,26,0.3);
        }
        .logo-text { display:flex; flex-direction:column; line-height:1; }
        .logo-title {
          font-family:var(--font-display); font-size:16px; font-weight:800;
          color:var(--text-primary); letter-spacing:0.08em;
        }
        .logo-subtitle {
          font-family:var(--font-mono); font-size:9px; color:var(--text-muted);
          letter-spacing:0.12em; text-transform:uppercase; margin-top:1px;
        }

        .nav-section-label {
          font-family:var(--font-mono); font-size:9px; letter-spacing:0.1em;
          color:var(--text-muted); padding:8px 16px 6px; text-transform:uppercase;
        }

        .sidebar-nav { flex:1; overflow-y:auto; padding-bottom:16px; }

        .nav-item {
          display:flex; align-items:center; gap:10px;
          padding:9px 16px; font-size:13px; font-weight:400;
          color:var(--text-secondary); text-decoration:none;
          transition:color 0.15s, background 0.15s;
          position:relative; font-family:var(--font-body); letter-spacing:0.01em;
        }
        .nav-item:hover { color:var(--text-primary); background:rgba(255,255,255,0.03); }
        .nav-item--active {
          color:var(--brand-orange) !important;
          background:rgba(247,147,26,0.06) !important;
        }
        .nav-item--active::before {
          content:''; position:absolute; left:0; top:0; bottom:0;
          width:2px; background:var(--brand-orange); border-radius:0 2px 2px 0;
        }
        .nav-item--soon { opacity:0.45; pointer-events:none; }

        .nav-icon { display:flex; align-items:center; opacity:0.7; flex-shrink:0; }
        .nav-item--active .nav-icon, .nav-item:hover .nav-icon { opacity:1; }
        .nav-label { flex:1; }

        .soon-badge {
          font-size:9px; font-family:var(--font-mono); text-transform:uppercase;
          letter-spacing:0.05em; background:rgba(247,147,26,0.1);
          color:var(--brand-orange); padding:1px 5px; border-radius:3px; opacity:0.7;
        }

        .sidebar-footer {
          padding:12px 16px; border-top:1px solid var(--border-subtle);
          font-family:var(--font-mono); font-size:9px; color:var(--text-muted); letter-spacing:0.03em;
        }
      `}</style>
    </aside>
  );
}
