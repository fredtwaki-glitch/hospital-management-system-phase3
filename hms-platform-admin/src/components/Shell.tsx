import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Shell() {
  const { logout } = useAuth();

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <Link to="/tenants" style={{ color: 'var(--paper-raised)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span className="eyebrow" style={{ color: 'var(--marigold)' }}>
            Platform
          </span>
          <h1 style={{ color: 'var(--paper-raised)', fontSize: 'var(--text-xl)' }}>Admin Console</h1>
        </Link>
        <button
          onClick={logout}
          className="btn"
          style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.3)', color: 'var(--paper-raised)' }}
        >
          Log out
        </button>
      </div>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
