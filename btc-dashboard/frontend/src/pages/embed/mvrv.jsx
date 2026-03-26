/**
 * pages/embed/mvrv.jsx
 * Versão embed-only do gráfico MVRV — sem Layout, Sidebar ou TopBar.
 * Uso: <iframe src="https://btc-dashboard-jade.vercel.app/embed/mvrv" />
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import MVRVChart from '../../components/charts/MVRVChart';

export default function EmbedMVRV() {
  const [mvrvData, setMvrvData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    fetch('/api/mvrv')
      .then(r => r.json())
      .then(d => {
        setMvrvData(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <>
      <Head>
        <title>MVRV · BTC Dashboard</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="embed-wrapper">
        <MVRVChart mvrvData={mvrvData} loading={loading} error={error} />
      </div>

      <style jsx global>{`
        /* Reset completo para o embed */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body, #__next {
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #0a0a0f;
          font-family: 'DM Sans', -apple-system, sans-serif;
        }

        /* CSS variables que o chart usa */
        :root {
          --bg-body: #0a0a0f;
          --bg-card: #111120;
          --border-subtle: #1e1e35;
          --text-primary: #e8e8f0;
          --text-secondary: #b0b0c8;
          --text-muted: #5a5a80;
          --brand-orange: #f7931a;
          --font-display: 'Syne', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          --font-body: 'DM Sans', sans-serif;
        }

        .embed-wrapper {
          width: 100%;
          height: 100vh;
          background: #0a0a0f;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </>
  );
}
