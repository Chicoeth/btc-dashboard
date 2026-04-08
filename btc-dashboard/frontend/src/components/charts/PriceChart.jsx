import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Clock, Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

function formatTime(date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TopBar({ isMobile, onMenuClick }) {
  const [time, setTime] = useState('');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setTime(formatTime(new Date()));
    const interval = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        {isMobile ? (
          <button className="hamburger-btn" onClick={onMenuClick} aria-label="Abrir menu">
            <Menu size={18} strokeWidth={1.5} />
          </button>
        ) : (
          <div className="topbar-divider" />
        )}
      </div>

      <div className="topbar-right">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {theme === 'dark' ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
        </button>
        <div className="status-indicator">
          <span className="status-dot" />
          <span className="status-text">Live</span>
        </div>
        <div className="topbar-time">
          <Clock size={10} strokeWidth={1.5} />
          <span>{time || '—'}</span>
        </div>
        <div className="topbar-badge">
          Dados históricos · Atualização diária
        </div>
      </div>

      <style jsx>{`
        .topbar {
          height: 40px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px; position: sticky; top: 0; z-index: 50;
          backdrop-filter: blur(8px);
        }
        .topbar-left { display: flex; align-items: center; gap: 12px; }
        .hamburger-btn {
          display: flex; align-items: center; justify-content: center;
          background: none; border: 1px solid var(--border-subtle);
          border-radius: 6px; color: var(--text-secondary); padding: 5px;
          cursor: pointer; transition: color 0.15s, border-color 0.15s;
        }
        .hamburger-btn:hover { color: var(--text-primary); border-color: var(--border-default); }
        .topbar-divider { width: 1px; height: 14px; background: var(--border-subtle); }
        .topbar-right { display: flex; align-items: center; gap: 14px; }
        .theme-toggle-btn {
          display: flex; align-items: center; justify-content: center;
          background: none; border: 1px solid var(--border-subtle);
          border-radius: 6px; color: var(--text-muted); padding: 4px;
          cursor: pointer; transition: color 0.2s, border-color 0.2s, background 0.2s;
        }
        .theme-toggle-btn:hover {
          color: var(--brand-orange); border-color: var(--brand-orange);
          background: rgba(247, 147, 26, 0.08);
        }
        .status-indicator { display: flex; align-items: center; gap: 5px; }
        .status-dot {
          width: 5px; height: 5px; background: #22c55e; border-radius: 50%;
          animation: pulseDot 2s ease-in-out infinite;
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
        }
        .status-text {
          font-family: var(--font-mono); font-size: 9px; color: #22c55e;
          letter-spacing: 0.08em; text-transform: uppercase;
        }
        .topbar-time {
          display: flex; align-items: center; gap: 4px;
          font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);
        }
        .topbar-badge {
          font-family: var(--font-mono); font-size: 9px; color: var(--text-muted);
          background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle);
          padding: 2px 7px; border-radius: 4px;
        }
        @media (max-width: 768px) {
          .topbar { padding: 0 12px; height: 38px; }
          .topbar-badge { display: none; }
          .topbar-right { gap: 10px; }
        }
      `}</style>
    </header>
  );
}
