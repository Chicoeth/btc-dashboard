import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ children }) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <TopBar />
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
      `}</style>
    </div>
  );
}
