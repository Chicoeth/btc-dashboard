import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Clock } from 'lucide-react';

const MOCK_STATS = [
  { label: 'BTC/USD', value: '—', change: null },
  { label: 'Volume 24h', value: '—', change: null },
  { label: 'Market Cap', value: '—', change: null },
  { label: 'Dominância', value: '—', change: null },
  { label: 'Halvings', value: '3', change: null },
  { label: 'Bloco Atual', value: '—', change: null },
];

function formatTime(date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TopBar() {
  const [time, setTime] = useState('');

  useEffect(() => {
    setTime(formatTime(new Date()));
    const interval = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="topbar">
      {/* Left: page title area */}
      <div className="topbar-left">
        <div className="topbar-divider" />
      </div>

      {/* Right: time + status */}
      <div className="topbar-right">
        <div className="status-indicator">
          <span className="status-dot" />
          <span className="status-text">Live</span>
        </div>
        <div className="topbar-time">
          <Clock size={11} strokeWidth={1.5} />
          <span>{time || '—'}</span>
        </div>
        <div className="topbar-badge">
          Dados históricos · Atualização diária
        </div>
      </div>

      <style jsx>{`
        .topbar {
          height: 48px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(8px);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .topbar-divider {
          width: 1px;
          height: 16px;
          background: var(--border-subtle);
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          background: #22c55e;
          border-radius: 50%;
          display: block;
          animation: pulseDot 2s ease-in-out infinite;
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
        }

        .status-text {
          font-family: var(--font-mono);
          font-size: 10px;
          color: #22c55e;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .topbar-time {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.04em;
        }

        .topbar-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.03em;
        }
      `}</style>
    </header>
  );
}
