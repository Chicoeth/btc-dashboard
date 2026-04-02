import { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  /* ─── Detect mobile (<= 768px) ─── */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileOpen(false);   // closing drawer when resizing to desktop
    };
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  /* Lock body scroll when mobile drawer is open */
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleMenuClick = useCallback(() => {
    setMobileOpen(true);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <div className={`layout ${collapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'is-mobile' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />
      <div className="main-content">
        <TopBar isMobile={isMobile} onMenuClick={handleMenuClick} />
        <main className="page-main">
          {children}
        </main>
      </div>

      <style jsx>{`
        .page-main {
          flex: 1;
          padding: 32px;
          animation: fadeIn 0.4s ease forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .page-main {
            padding: 12px 8px;
          }
        }
      `}</style>
    </div>
  );
}
