import Link from 'next/link';
import { useRouter } from 'next/router';
import { TrendingUp, Activity, BarChart2, Users, Divide, GitCompareArrows, Building2, Landmark, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';

const NAV = [
  { label: 'Preço Histórico',        href: '/mercado/preco',                icon: TrendingUp       },
  { label: 'MVRV',                   href: '/indicadores/mvrv',             icon: BarChart2         },
  { label: 'STH MVRV',               href: '/indicadores/sth-mvrv',         icon: Users             },
  { label: 'Múltiplo de Mayer',      href: '/indicadores/multiplo-mayer',   icon: Divide            },
  { label: 'Índice Medo & Ganância', href: '/indicadores/medo-ganancia',    icon: Activity          },
  { label: 'Comparador de Ciclos',   href: '/indicadores/comparador-ciclos', icon: GitCompareArrows },
  { label: 'Strategy (MSTR)',        href: '/indicadores/strategy',          icon: Building2        },
  { label: 'ETFs de Bitcoin',        href: '/indicadores/etf-holdings',      icon: Landmark         },
];

export default function Sidebar({ collapsed, onToggle, isMobile, mobileOpen, onMobileClose }) {
  const router = useRouter();

  /* Close drawer on navigation (mobile) */
  const handleNavClick = (e, href, soon) => {
    if (soon) {
      e.preventDefault();
      return;
    }
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  /* Determine sidebar visibility class */
  const sidebarClass = [
    'sidebar',
    !isMobile && collapsed ? 'sidebar--collapsed' : '',
    isMobile ? 'sidebar--mobile' : '',
    isMobile && mobileOpen ? 'sidebar--mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Overlay behind drawer on mobile */}
      {isMobile && mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <aside className={sidebarClass}>
        <div className="logo">
          <img
            src="/paradigma-effigy.png"
            alt="Paradigma"
            className="logo-effigy"
            width={38}
            height={38}
          />
          {(!collapsed || isMobile) && (
            <div className="logo-text">
              <span className="logo-title">Paradigma</span>
              <span className="logo-subtitle">Dashboard</span>
            </div>
          )}
          {/* Close button on mobile */}
          {isMobile && (
            <button className="mobile-close" onClick={onMobileClose} aria-label="Fechar menu">
              <X size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {(!collapsed || isMobile) && <div className="nav-section-label">INDICADORES</div>}

        <nav className="sidebar-nav">
          {NAV.map(({ label, href, icon: Icon, soon }) => {
            const active = router.pathname === href;
            return (
              <Link
                key={href}
                href={soon ? '#' : href}
                className={`nav-item ${active ? 'nav-item--active' : ''} ${soon ? 'nav-item--soon' : ''}`}
                title={!isMobile && collapsed ? label : undefined}
                onClick={(e) => handleNavClick(e, href, soon)}
              >
                <span className="nav-icon"><Icon size={15} strokeWidth={1.5} /></span>
                {(!collapsed || isMobile) && <span className="nav-label">{label}</span>}
                {(!collapsed || isMobile) && soon && <span className="soon-badge">em breve</span>}
              </Link>
            );
          })}
        </nav>

        {/* Desktop collapse toggle — hidden on mobile */}
        {!isMobile && (
          <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
            {collapsed
              ? <PanelLeftOpen size={16} strokeWidth={1.5} />
              : <PanelLeftClose size={16} strokeWidth={1.5} />
            }
          </button>
        )}

        {(!collapsed || isMobile) && (
          <div className="sidebar-footer">
            <span>Dados atualizados diariamente</span>
          </div>
        )}

        <style jsx>{`
          /* ─── Overlay ─── */
          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 199;
            backdrop-filter: blur(2px);
            animation: fadeOverlay 0.25s ease forwards;
          }
          @keyframes fadeOverlay {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          /* ─── Mobile close button ─── */
          .mobile-close {
            margin-left: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: none;
            border: 1px solid var(--border-subtle);
            border-radius: 6px;
            color: var(--text-muted);
            padding: 5px;
            cursor: pointer;
            transition: color 0.15s, border-color 0.15s;
          }
          .mobile-close:hover {
            color: var(--text-primary);
            border-color: var(--border-default);
          }

          /* ─── Logo ─── */
          .logo {
            display:flex; align-items:center; gap:10px;
            padding:20px 16px 18px; border-bottom:1px solid var(--border-subtle); margin-bottom:8px;
          }
          .sidebar--collapsed .logo {
            justify-content:center; padding:20px 0 18px;
          }
          .logo-effigy {
            width:38px; height:38px; flex-shrink:0;
            object-fit:contain;
          }
          .logo-text { display:flex; flex-direction:column; line-height:1; }
          .logo-title {
            font-family: 'Barlow', var(--font-display), sans-serif;
            font-size:17px; font-weight:700;
            color:var(--text-primary); letter-spacing:0.02em;
          }
          .logo-subtitle {
            font-family:var(--font-mono); font-size:9px; color:var(--text-muted);
            letter-spacing:0.12em; text-transform:uppercase; margin-top:2px;
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
          .sidebar--collapsed .nav-item {
            justify-content:center; padding:10px 0;
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

          .sidebar-toggle {
            display:flex; align-items:center; justify-content:center;
            margin:0 12px 8px; padding:8px;
            background:transparent; border:1px solid var(--border-subtle);
            border-radius:6px; color:var(--text-muted); cursor:pointer;
            transition:color 0.15s, border-color 0.15s, background 0.15s;
          }
          .sidebar--collapsed .sidebar-toggle {
            margin:0 8px 8px;
          }
          .sidebar-toggle:hover {
            color:var(--text-primary); border-color:var(--border-default);
            background:rgba(255,255,255,0.03);
          }

          .sidebar-footer {
            padding:12px 16px; border-top:1px solid var(--border-subtle);
            font-family:var(--font-mono); font-size:9px; color:var(--text-muted); letter-spacing:0.03em;
          }

          /* ─── Mobile drawer ─── */
          @media (max-width: 768px) {
            .nav-item {
              padding: 12px 16px;
              font-size: 14px;
            }
          }
        `}</style>
      </aside>
    </>
  );
}
