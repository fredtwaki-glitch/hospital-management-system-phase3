import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Shell() {
  const { logout } = useAuth();

  return (
    <div className="portal-shell">
      <div className="portal-topbar">
        <h1 style={{ color: 'var(--paper-raised)', fontSize: 'var(--text-lg)' }}>Patient Portal</h1>
        <button onClick={logout} className="btn" style={{ background: 'transparent', color: 'var(--paper-raised)', border: '1px solid rgba(255,255,255,0.3)', padding: '4px 10px', fontSize: 'var(--text-xs)' }}>
          Log out
        </button>
      </div>
      <div className="portal-content">
        <Outlet />
      </div>
      <nav className="portal-tabbar">
        <TabLink to="/">Visits</TabLink>
        <TabLink to="/prescriptions">Prescriptions</TabLink>
        <TabLink to="/labs">Labs</TabLink>
        <TabLink to="/chat">Chat</TabLink>
      </nav>
    </div>
  );
}

function TabLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `portal-tab${isActive ? ' active' : ''}`}>
      {children}
    </NavLink>
  );
}
