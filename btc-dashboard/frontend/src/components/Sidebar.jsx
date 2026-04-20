import Link from 'next/link';
import { useRouter } from 'next/router';
import { TrendingUp, Activity, BarChart2, Users, Divide, GitCompareArrows, Building2, Landmark, Calculator, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'INDICADORES',
    items: [
      { label: 'Preço Histórico',        href: '/mercado/preco',                icon: TrendingUp       },
      { label: 'MVRV',                   href: '/indicadores/mvrv',             icon: BarChart2         },
      { label: 'STH MVRV',               href: '/indicadores/sth-mvrv',         icon: Users             },
      { label: 'Múltiplo de Mayer',      href: '/indicadores/multiplo-mayer',   icon: Divide            },
      { label: 'Índice Medo & Ganância', href: '/indicadores/medo-ganancia',    icon: Activity          },
      { label: 'Comparador de Ciclos',   href: '/indicadores/comparador-ciclos', icon: GitCompareArrows },
      { label: 'Strategy (MSTR)',        href: '/indicadores/strategy',          icon: Building2        },
      { label: 'ETFs de Bitcoin',        href: '/indicadores/etf-holdings',      icon: Landmark         },
    ],
  },
  {
    label: 'FERRAMENTAS',
    items: [
      { label: 'Simulador de DCA',       href: '/ferramentas/dca-simulador',    icon: Calculator        },
    ],
  },
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

  const showLabels = !collapsed || isMobile;

  return (
    <>
      {/* Overlay behind drawer on mobile */}
      {isMobile && mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <aside className={sidebarClass}>
        <div className="logo">
          <Link href="/" className="logo-link">
            <img
              src="/paradigma-effigy.png"
              alt="Paradigma"
              className="logo-effigy"
              width={44}
              height={44}
            />
            {showLabels && (
              <div className="logo-text">
                <span className="logo-title">Paradigma</span>
                <span className="logo-subtitle">Dashboard</span>
              </div>
            )}
          </Link>
          {/* Close button on mobile */}
          {isMobile && (
            <button className="mobile-close" onClick={onMobileClose} aria-label="Fechar menu">
              <X size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={section.label} className={`nav-section ${idx > 0 ? 'nav-section--divided' : ''}`}>
              {showLabels && <div className="nav-section-label">{section.label}</div>}
              {section.items.map(({ label, href, icon: Icon, soon }) => {
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
                    {showLabels && <span className="nav-label">{label}</span>}
                    {showLabels && soon && <span className="soon-badge">em breve</span>}
                  </Link>
                );
              })}
            </div>
          ))}
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
            padding:20px 20px 18px 24px; border-bottom:1px solid var(--border-subtle); margin-bottom:8px;
          }
          .sidebar--collapsed .logo {
            justify-content:center; padding:20px 0 18px;
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

          .nav-section {
            display: flex;
            flex-direction: column;
          }
          .nav-section--divided {
            margin-top: 14px;
            padding-top: 10px;
            border-top: 1px solid var(--border-subtle);
          }
          .sidebar--collapsed .nav-section--divided {
            margin-top: 10px;
            padding-top: 8px;
          }

          .nav-section-label {
            font-family:var(--font-mono); font-size:9px; letter-spacing:0.1em;
            color:var(--text-muted); padding:8px 20px 6px 24px; text-transform:uppercase;
          }

          .sidebar-nav { flex:1; overflow-y:auto; padding-bottom:16px; }

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
        `}</style>

        {/* Nav items rendered by <Link> are outside styled-jsx scope,
            so these styles must be global to reach the <a> elements */}
        <style jsx global>{`
          .sidebar .logo-link {
            display:flex; align-items:center; gap:10px;
            text-decoration:none; cursor:pointer;
          }
          .sidebar .logo-effigy {
            width:44px; height:44px; flex-shrink:0;
            object-fit:contain;
          }

          .sidebar .nav-item {
            display:flex; align-items:center; gap:10px;
            padding:9px 20px 9px 24px; font-size:13px; font-weight:400;
            color:var(--text-secondary); text-decoration:none;
            transition:color 0.15s, background 0.15s;
            position:relative; font-family:var(--font-body); letter-spacing:0.01em;
          }
          .sidebar--collapsed .nav-item {
            justify-content:center; padding:10px 0;
          }
          .sidebar .nav-item:hover { color:var(--text-primary); background:rgba(255,255,255,0.03); }
          .sidebar .nav-item--active {
            color:var(--brand-orange) !important;
            background:rgba(247,147,26,0.06) !important;
          }
          .sidebar .nav-item--active::before {
            content:''; position:absolute; left:0; top:0; bottom:0;
            width:2px; background:var(--brand-orange); border-radius:0 2px 2px 0;
          }
          .sidebar .nav-item--soon { opacity:0.45; pointer-events:none; }

          .sidebar .nav-icon { display:flex; align-items:center; opacity:0.7; flex-shrink:0; }
          .sidebar .nav-item--active .nav-icon,
          .sidebar .nav-item:hover .nav-icon { opacity:1; }
          .sidebar .nav-label { flex:1; }

          .sidebar .soon-badge {
            font-size:9px; font-family:var(--font-mono); text-transform:uppercase;
            letter-spacing:0.05em; background:rgba(247,147,26,0.1);
            color:var(--brand-orange); padding:1px 5px; border-radius:3px; opacity:0.7;
          }

          /* ─── Mobile drawer ─── */
          @media (max-width: 768px) {
            .sidebar .nav-item {
              padding: 12px 20px 12px 24px;
              font-size: 14px;
            }
          }
        `}</style>
      </aside>
    </>
  );
}
